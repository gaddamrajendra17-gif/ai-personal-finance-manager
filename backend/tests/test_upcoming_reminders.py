import os
import pytest
from datetime import datetime, timedelta
from app.models.finance import RecurringTransaction, Account, Alert
from app.models.user import User
from app.services.recurring_service import check_and_send_upcoming_reminders
from app.services.email_service import get_mock_emails, clear_mock_emails

def test_check_and_send_upcoming_reminders(db_session):
    """
    Test that upcoming bills due in <= 3 days trigger notifications and email alerts,
    and prevent duplicate reminders.
    """
    # Clean simulated inbox first
    clear_mock_emails()
    
    # 1. Setup Test User
    user = User(
        email="remindertest@pfm.com",
        full_name="Reminder Test User",
        hashed_password="hashed_password_123",
        monthly_income=60000.0,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # 2. Setup Test Bank Account
    account = Account(
        user_id=user.id,
        bank_name="Test Bank Corp",
        account_token="simulated:token_123",
        account_last4="9999",
        account_type="savings",
        balance=15000.0
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    # 3. Setup Recurring Transaction due in 2 days (upcoming!)
    due_date = datetime.utcnow() + timedelta(days=2)
    recurring = RecurringTransaction(
        user_id=user.id,
        account_id=account.id,
        merchant="Spotify Premium",
        amount=119.0,
        category="Entertainment",
        transaction_type="DEBIT",
        frequency="monthly",
        next_date=due_date,
        is_active=True,
        last_reminder_date=None
    )
    db_session.add(recurring)
    db_session.commit()
    db_session.refresh(recurring)

    # 4. Trigger the upcoming reminders check
    import asyncio
    asyncio.run(check_and_send_upcoming_reminders(db=db_session))

    # 5. Assert database state
    db_session.refresh(recurring)
    assert recurring.last_reminder_date is not None
    assert (datetime.utcnow() - recurring.last_reminder_date).total_seconds() < 60  # Sent just now

    # Check notification in app (it gets inserted into Notifications table)
    from app.services.notification_service import Notification
    notif = db_session.query(Notification).filter(Notification.user_id == user.id).first()
    assert notif is not None
    assert "Upcoming Bill: Spotify Premium" in notif.title
    assert "due on" in notif.message

    # Check mock email output
    emails = get_mock_emails()
    assert len(emails) == 1
    assert emails[0]["to"] == "remindertest@pfm.com"
    assert "Upcoming Bill" in emails[0]["subject"]
    assert "Spotify Premium" in emails[0]["body"]

    # 6. Re-run and ensure no duplicate notifications are sent
    prev_reminder_date = recurring.last_reminder_date
    asyncio.run(check_and_send_upcoming_reminders(db=db_session))
    
    db_session.refresh(recurring)
    assert recurring.last_reminder_date == prev_reminder_date  # Unchanged
    
    # Notifications and email counts should remain 1
    assert db_session.query(Notification).filter(Notification.user_id == user.id).count() == 1
    assert len(get_mock_emails()) == 1

    # Cleanup
    clear_mock_emails()

