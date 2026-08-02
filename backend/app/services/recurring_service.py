from datetime import datetime, timedelta
import calendar
import uuid
from app.core.database import SessionLocal
from app.models.finance import RecurringTransaction, Transaction, Account
from app.models.user import User
from app.services.budget_service import update_budget_on_transaction
from app.services.notification_service import create_notification
from app.services.email_service import send_email_reminder

from sqlalchemy.orm import Session

async def check_and_send_upcoming_reminders(db: Session = None):
    db_provided = db is not None
    if not db_provided:
        db = SessionLocal()
    try:
        now = datetime.utcnow()
        three_days_from_now = now + timedelta(days=3)
        
        # Find active recurring transactions that are upcoming (due in the next 3 days)
        upcoming_items = db.query(RecurringTransaction).filter(
            RecurringTransaction.is_active == True,
            RecurringTransaction.next_date > now,
            RecurringTransaction.next_date <= three_days_from_now
        ).all()

        for item in upcoming_items:
            # Check if reminder has already been sent for this upcoming date
            # Skip if last_reminder_date is set and it is after (next_date - 3 days)
            window_start = item.next_date - timedelta(days=3)
            if item.last_reminder_date and item.last_reminder_date >= window_start:
                continue

            # Fetch user email
            user = db.query(User).filter(User.id == item.user_id).first()
            user_email = user.email if user else "demo@pfm.com"

            # 1. Send in-app notification
            title = f"Upcoming Bill: {item.merchant}"
            msg = f"Your recurring {item.frequency} bill for {item.merchant} ({item.category}) of Rs.{item.amount:,.0f} is due on {item.next_date.strftime('%d %b %Y')}."
            create_notification(db, item.user_id, title, msg, "warning")

            # 2. Send email reminder with a premium template
            html_body = f"""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
                    <span style="font-size: 40px; display: block; margin-bottom: 8px;">⏰</span>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Upcoming Bill Reminder</h2>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #c7d2fe;">PFM AI Personal Finance Manager</p>
                </div>
                <div style="padding: 24px; color: #334155; line-height: 1.6; font-size: 14px;">
                    <p style="margin-top: 0;">Hello,</p>
                    <p>This is a friendly reminder that a scheduled recurring transaction is due soon. Here are the details:</p>
                    <div style="background-color: #f8fafc; padding: 20px; border-left: 4px solid #6366f1; margin: 20px 0; border-radius: 8px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 100px;">Merchant</td>
                                <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">{item.merchant}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Amount</td>
                                <td style="padding: 6px 0; color: #ef4444; font-weight: 700; font-size: 15px;">₹{item.amount:,.2f}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Category</td>
                                <td style="padding: 6px 0; color: #1e293b;">{item.category}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Due Date</td>
                                <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">{item.next_date.strftime('%d %B %Y')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Frequency</td>
                                <td style="padding: 6px 0; color: #1e293b; text-transform: capitalize;">{item.frequency}</td>
                            </tr>
                        </table>
                    </div>
                    <p>We will automatically process this transaction and update your account balance on the due date. Please ensure you maintain a sufficient balance in your linked account.</p>
                </div>
                <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
                    This is an automated notification. To manage your subscriptions, log in to your PFM AI account.
                </div>
            </div>
            """
            
            subject = f"Upcoming Bill: ₹{item.amount:,.0f} due for {item.merchant}"
            send_email_reminder(user_email, subject, html_body)

            # Mark as sent
            item.last_reminder_date = now
            db.commit()
    except Exception as e:
        print(f"Error checking upcoming transactions: {e}")
        db.rollback()
    finally:
        if not db_provided:
            db.close()

async def check_and_run_recurring(db: Session = None):
    db_provided = db is not None
    if not db_provided:
        db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Find active recurring transactions whose next_date is due
        due_items = db.query(RecurringTransaction).filter(
            RecurringTransaction.is_active == True,
            RecurringTransaction.next_date <= now
        ).all()

        for item in due_items:
            # Process transaction creation
            txn = Transaction(
                id=uuid.uuid4(),
                account_id=item.account_id,
                amount=item.amount,
                merchant=item.merchant,
                description=f"Automated recurring {item.frequency} transaction",
                category=item.category,
                transaction_type=item.transaction_type,
                is_recurring=True,
                timestamp=item.next_date,  # use scheduled time
            )
            db.add(txn)

            # Update account balance
            account = db.query(Account).filter(Account.id == item.account_id).first()
            if account:
                if item.transaction_type == "DEBIT":
                    account.balance -= item.amount
                    # Update budget tracking
                    update_budget_on_transaction(str(item.user_id), item.category, item.amount, db)
                else:
                    account.balance += item.amount

            # Send WS Notification & App Notification
            notif_type = "success" if item.transaction_type == "CREDIT" else "info"
            title = f"Automated {item.category}"
            msg = f"Rs.{item.amount:,.0f} {item.transaction_type.lower()}ed automatically for {item.merchant}."
            create_notification(db, item.user_id, title, msg, notif_type)

            # Send WebSocket notification
            try:
                from app.api.notifications_api import manager as ws_manager
                await ws_manager.send_to_user(str(item.user_id), {
                    "type": "new_transaction",
                    "transaction": {
                        'id': str(txn.id),
                        'amount': txn.amount if txn.transaction_type == 'CREDIT' else -abs(txn.amount),
                        'merchant': txn.merchant,
                        'category': txn.category,
                        'transaction_type': txn.transaction_type,
                        'timestamp': str(txn.timestamp),
                    }
                })
            except Exception:
                pass

            # Update next_date based on frequency
            next_dt = item.next_date
            if item.frequency == "daily":
                next_dt += timedelta(days=1)
            elif item.frequency == "weekly":
                next_dt += timedelta(weeks=1)
            elif item.frequency == "monthly":
                month = next_dt.month
                year = next_dt.year
                day = next_dt.day
                if month == 12:
                    month = 1
                    year += 1
                else:
                    month += 1
                _, last_day = calendar.monthrange(year, month)
                day = min(day, last_day)
                next_dt = datetime(year, month, day, next_dt.hour, next_dt.minute, next_dt.second)
            
            item.next_date = next_dt
            db.commit()
    except Exception as e:
        print(f"Error executing recurring transactions: {e}")
        db.rollback()
    finally:
        if not db_provided:
            db.close()
