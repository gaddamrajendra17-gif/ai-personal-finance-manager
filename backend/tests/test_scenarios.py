import pytest
import time
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
from uuid import uuid4

from app.models.user import User
from app.models.finance import Account, Transaction, Budget, SavingsGoal, Alert, Forecast
from app.api.gamification import Badge, UserBadge, seed_gamification
from app.api.notifications_api import manager as ws_manager


# ── Scenario 1: Transaction creation triggers categorization ──────────────────
@patch("app.api.transactions.check_anomaly")
def test_transaction_creation_triggers_categorization(mock_anomaly, client, auth_headers, db_session):
    """Scenario 1: Transaction creation triggers categorization (Category assigned within 200ms)"""
    mock_anomaly.return_value = (False, 0.0)

    # 1. Create a bank account
    acct_resp = client.post(
        "/api/accounts/",
        json={
            "bank_name": "Scenario 1 Bank",
            "account_token": "token_s1",
            "account_last4": "1111",
            "account_type": "savings",
            "balance": 5000.0
        },
        headers=auth_headers
    )
    assert acct_resp.status_code == 200
    account_id = acct_resp.json()["id"]

    # 2. Add a DEBIT transaction and measure time
    start_time = time.perf_counter()
    txn_resp = client.post(
        "/api/transactions/",
        json={
            "account_id": account_id,
            "amount": 250.0,
            "merchant": "Swiggy",
            "description": "Lunch order",
            "transaction_type": "DEBIT",
            "timestamp": datetime.now().isoformat()
        },
        headers=auth_headers
    )
    duration = (time.perf_counter() - start_time) * 1000  # In milliseconds
    
    assert txn_resp.status_code == 200
    txn_data = txn_resp.json()
    
    # Assert category was assigned by rule-based/ML engine
    assert txn_data["category"] == "Food & Dining"
    # Assert duration was within 200ms
    assert duration < 200.0, f"Categorization took too long: {duration:.2f}ms"


# ── Scenario 2: Categorized transaction triggers anomaly check ────────────────
def test_categorized_transaction_triggers_anomaly_check(client, auth_headers, db_session):
    """Scenario 2: Categorized transaction triggers anomaly check (Anomaly score computed and stored)"""
    # 1. Find user and create a bank account
    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()
    account = Account(
        bank_name="Scenario 2 Bank",
        account_token="token_s2",
        account_last4="2222",
        account_type="savings",
        balance=20000.0,
        user_id=user.id
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    # 2. Insert 10 normal DEBIT transactions to satisfy the >10 transaction requirement for anomaly checker
    for i in range(10):
        txn = Transaction(
            account_id=account.id,
            amount=100.0,
            merchant="Regular Merchant",
            transaction_type="DEBIT",
            category="Shopping",
            timestamp=datetime.utcnow() - timedelta(days=i+1)
        )
        db_session.add(txn)
    db_session.commit()

    # 3. Add an anomalous transaction (large spike z-score)
    txn_resp = client.post(
        "/api/transactions/",
        json={
            "account_id": str(account.id),
            "amount": 10000.0,  # Massive spike relative to mean=100, std=0 (std defaults to 1)
            "merchant": "Suspect Merchant",
            "description": "Expensive purchase",
            "transaction_type": "DEBIT",
            "timestamp": datetime.now().isoformat()
        },
        headers=auth_headers
    )
    assert txn_resp.status_code == 200
    txn_data = txn_resp.json()

    # Check that anomaly flag and score were computed and stored
    assert txn_data["is_anomaly"] is True
    assert txn_data["anomaly_score"] >= 0.5

    # Check that an alert was generated and stored in the database
    alert = db_session.query(Alert).filter(
        Alert.user_id == user.id,
        Alert.alert_type == "ANOMALY"
    ).first()
    assert alert is not None
    assert "Suspect Merchant" in alert.message


# ── Scenario 3: Budget overrun triggers WebSocket alert ───────────────────────
@patch("app.api.notifications_api.manager.send_to_user", new_callable=AsyncMock)
@patch("app.api.transactions.categorize_transaction")
@patch("app.api.transactions.check_anomaly")
def test_budget_overrun_triggers_websocket_alert(mock_anomaly, mock_categorize, mock_ws_send, client, auth_headers, db_session):
    """Scenario 3: Budget overrun triggers WebSocket alert (Alert delivered to client within 500ms)"""
    mock_categorize.return_value = ("Shopping", None)
    mock_anomaly.return_value = (False, 0.0)

    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()
    
    # 1. Create a bank account
    account = Account(
        bank_name="Scenario 3 Bank",
        account_token="token_s3",
        account_last4="3333",
        account_type="savings",
        balance=10000.0,
        user_id=user.id
    )
    db_session.add(account)

    # 2. Setup a Shopping budget limit of 500
    now = datetime.utcnow()
    budget = Budget(
        user_id=user.id,
        category="Shopping",
        limit_amount=500.0,
        spent_amount=400.0,
        month=now.month,
        year=now.year
    )
    db_session.add(budget)
    db_session.commit()

    # 3. Create a transaction that overruns the budget (new total spent = 400 + 200 = 600 > 500)
    start_time = time.perf_counter()
    txn_resp = client.post(
        "/api/transactions/",
        json={
            "account_id": str(account.id),
            "amount": 200.0,
            "merchant": "Amazon Store",
            "transaction_type": "DEBIT",
            "timestamp": datetime.now().isoformat()
        },
        headers=auth_headers
    )
    duration = (time.perf_counter() - start_time) * 1000

    assert txn_resp.status_code == 200
    assert duration < 500.0, f"Budget overrun alert took too long: {duration:.2f}ms"

    # Assert budget spent_amount was updated
    db_session.refresh(budget)
    assert budget.spent_amount == 600.0

    # Assert BUDGET_EXCEEDED alert is created in database
    alert = db_session.query(Alert).filter(
        Alert.user_id == user.id,
        Alert.alert_type == "BUDGET_EXCEEDED"
    ).first()
    assert alert is not None
    assert "Shopping" in alert.title

    # Assert WebSocket manager was called to notify the user (once for budget overrun, once for transaction creation)
    assert mock_ws_send.call_count == 2
    
    calls = mock_ws_send.call_args_list
    budget_alert_call = next((c for c in calls if c[0][1].get("type") == "budget_alert"), None)
    assert budget_alert_call is not None, "WebSocket notification for budget_alert not found"
    
    target_user_id, alert_payload = budget_alert_call[0]
    assert target_user_id == str(user.id)
    assert alert_payload["type"] == "budget_alert"
    assert alert_payload["alert"]["alert_type"] == "BUDGET_EXCEEDED"


# ── Scenario 4: SMS parse → transaction ingestion ────────────────────────────
def test_sms_parse_to_transaction_ingestion(client, db_session):
    """Scenario 4: SMS parse -> transaction ingestion (Transaction created with correct fields)"""
    # 1. Create a user with a specific phone number
    user_email = "smsuser@pfm.com"
    user_phone = "+919876543210"
    
    # Check if user already exists
    user = db_session.query(User).filter(User.email == user_email).first()
    if not user:
        user = User(
            email=user_email,
            full_name="SMS User",
            hashed_password="mock_hashed_password",
            phone=user_phone,
            monthly_income=40000.0,
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    # Create account for this user
    account = Account(
        bank_name="SMS User Bank",
        account_token="token_sms",
        account_last4="4444",
        account_type="savings",
        balance=10000.0,
        user_id=user.id
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    # 2. POST SMS webhook payload to parse and ingest
    sms_payload = {
        "phone": user_phone,
        "message": "Dear customer, your A/C has been debited by Rs.2,500 on 21-May-2026 for transaction at Zomato Ref 123456.",
        "sender": "HDFC-BANK",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    response = client.post("/api/sms/webhook", json=sms_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["transaction"]["amount"] == 2500.0
    assert data["transaction"]["category"] == "Food & Dining"
    assert data["transaction"]["merchant"] == "Zomato"

    # Verify transaction is in database and balance updated correctly
    txn = db_session.query(Transaction).filter(Transaction.account_id == account.id).first()
    assert txn is not None
    assert txn.amount == 2500.0
    assert txn.transaction_type == "DEBIT"
    assert txn.merchant == "Zomato"
    assert txn.category == "Food & Dining"

    # Balance should be updated: 10000 - 2500 = 7500
    db_session.refresh(account)
    assert account.balance == 7500.0


# ── Scenario 5: Chatbot query retrieves relevant context ──────────────────────
def test_chatbot_query_retrieves_relevant_context(client, auth_headers, db_session):
    """Scenario 5: Chatbot query retrieves relevant context (Top-5 relevant transactions returned)"""
    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()

    account = Account(
        bank_name="Scenario 5 Bank",
        account_token="token_s5",
        account_last4="5555",
        account_type="savings",
        balance=10000.0,
        user_id=user.id
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    # 1. Create a set of transactions with specific terms
    matching_txns = []
    # Create 3 transactions matching "McDonalds"
    for i in range(3):
        txn = Transaction(
            account_id=account.id,
            amount=150.0 + i,
            merchant="McDonalds Store",
            transaction_type="DEBIT",
            category="Food & Dining",
            description=f"Happy Meal {i}",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(txn)
        matching_txns.append(txn)

    # Create 3 non-matching transactions
    for i in range(3):
        txn = Transaction(
            account_id=account.id,
            amount=99.0,
            merchant="Shell Petrol",
            transaction_type="DEBIT",
            category="Transport",
            description="Gas fill up",
            timestamp=datetime.utcnow() - timedelta(days=i+5)
        )
        db_session.add(txn)
    db_session.commit()

    # 2. Call the chat endpoint with a query containing "McDonalds"
    # We patch the chat_with_ai call to avoid external LLM invocation, but keep RAG active
    with patch("app.api.ai_routes.chat_with_ai", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = ("Mocked AI response.", "Thoughts", [])
        
        response = client.post(
            "/api/chat/",
            json={"message": "How much did I spend at McDonalds?"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify that relevant transactions are matched and returned
        assert "relevant_transactions" in data
        rt = data["relevant_transactions"]
        
        # Should return the 3 McDonalds transactions
        assert len(rt) == 3
        for item in rt:
            assert "McDonalds" in item["merchant"]


# ── Scenario 6: Login streak increments on daily login ────────────────────────
def test_login_streak_increments_on_daily_login(client, db_session):
    """Scenario 6: Login streak increments on daily login (Streak +1, points updated)"""
    user_email = "streakuser@pfm.com"
    user_pwd = "Password123!"
    
    # 1. Register or find user
    user = db_session.query(User).filter(User.email == user_email).first()
    if not user:
        from app.core.security import get_password_hash
        user = User(
            email=user_email,
            full_name="Streak User",
            hashed_password=get_password_hash(user_pwd),
            monthly_income=50000.0,
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    # 2. Set last_login to yesterday, points to 100, streak to 5
    user.last_login = datetime.utcnow() - timedelta(days=1)
    user.login_streak = 5
    user.points = 100
    db_session.commit()

    # 3. Post login form
    response = client.post(
        "/api/auth/login",
        data={"username": user_email, "password": user_pwd}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Verify login streak is incremented by 1 (5 -> 6) and points updated (100 -> 110)
    assert data["user"]["login_streak"] == 6
    # Refresh DB session to read DB fields
    db_session.refresh(user)
    assert user.login_streak == 6
    assert user.points == 110


# ── Scenario 7: Savings goal completion awards badge ──────────────────────────
def test_savings_goal_completion_awards_badge(client, auth_headers, db_session):
    """Scenario 7: Savings goal completion awards badge (Badge 'Goal Achiever' created in profile)"""
    seed_gamification(db_session)
    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()

    # 1. Create a savings goal with target 1000 and current_amount 900
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="Buy a gadget",
        target_amount=1000.0,
        current_amount=900.0,
        deadline=datetime.utcnow() + timedelta(days=30)
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    # Ensure "Goal Achiever" badge is NOT already earned
    db_session.query(UserBadge).filter(
        UserBadge.user_id == user.id,
        UserBadge.badge_key == "goal_achiever"
    ).delete()
    db_session.commit()

    # 2. Call contribute endpoint to complete the goal (+100 contribution)
    resp = client.put(
        f"/api/goals/{goal.id}/contribute?amount=100",
        headers=auth_headers
    )
    assert resp.status_code == 200
    goal_data = resp.json()
    assert goal_data["is_completed"] is True
    assert goal_data["current_amount"] == 1000.0

    # 3. Verify badge 'Goal Achiever' is awarded to the user
    user_badge = db_session.query(UserBadge).filter(
        UserBadge.user_id == user.id,
        UserBadge.badge_key == "goal_achiever"
    ).first()
    assert user_badge is not None


# ── Scenario 8: Refresh token issues new access token ─────────────────────────
def test_refresh_token_issues_new_access_token(client, db_session):
    """Scenario 8: Refresh token issues new access token (Valid JWT returned, old token invalid)"""
    user_email = "refreshuser@pfm.com"
    user_pwd = "Password123!"

    # 1. Register a user to get initial access & refresh tokens
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "email": user_email,
            "password": user_pwd,
            "full_name": "Refresh User",
            "monthly_income": 45000.0
        }
    )
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    first_refresh_token = reg_data["refresh_token"]
    assert first_refresh_token is not None

    # 2. Call the refresh token endpoint with the valid refresh token
    ref_resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": first_refresh_token}
    )
    assert ref_resp.status_code == 200
    ref_data = ref_resp.json()
    
    # Assert a new access token and fresh refresh token are returned
    second_access_token = ref_data["access_token"]
    second_refresh_token = ref_data["refresh_token"]
    assert second_access_token is not None
    assert second_refresh_token is not None
    assert second_refresh_token != first_refresh_token

    # 3. Call refresh endpoint again with the OLD/used refresh token
    dup_ref_resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": first_refresh_token}
    )
    # Assert that old token is now invalid and returns 401 Unauthorized
    assert dup_ref_resp.status_code == 401


# ── Scenario 9: Prophet forecast persists to database ─────────────────────────
def test_prophet_forecast_persists_to_database(client, auth_headers, db_session):
    """Scenario 9: Prophet forecast persists to database (Forecast rows created for 90 days)"""
    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()

    # Clear any old forecasts
    db_session.query(Forecast).filter(Forecast.user_id == user.id).delete()
    db_session.commit()

    # Create account and add a few transactions so that get_user_daily_spending doesn't crash
    account = Account(
        bank_name="Scenario 9 Bank",
        account_token="token_s9",
        account_last4="9999",
        account_type="savings",
        balance=15000.0,
        user_id=user.id
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    for i in range(15):
        txn = Transaction(
            account_id=account.id,
            amount=100.0,
            merchant="Daily Coffee",
            transaction_type="DEBIT",
            category="Food & Dining",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(txn)
    db_session.commit()

    # Call the forecast endpoint asking for 90 days
    resp = client.get(
        "/api/forecast/?periods=90",
        headers=auth_headers
    )
    assert resp.status_code == 200
    forecast_data = resp.json()
    assert forecast_data["status"] == "success"

    # Verify that exactly 90 days of forecast rows are created/persisted in the database
    db_forecasts = db_session.query(Forecast).filter(Forecast.user_id == user.id).all()
    assert len(db_forecasts) == 90
    
    # Assert date order and attributes
    db_forecasts.sort(key=lambda x: x.date)
    assert db_forecasts[0].predicted_amount is not None


# ── Scenario 10: Multi-user WebSocket isolation ───────────────────────────────
@pytest.mark.asyncio
async def test_multi_user_websocket_isolation():
    """Scenario 10: Multi-user WebSocket isolation (User A messages aren't delivered to User B)"""
    user_a_id = "user_a_uuid_123"
    user_b_id = "user_b_uuid_456"

    # Mock WebSocket objects
    ws_a = AsyncMock()
    ws_b = AsyncMock()

    # 1. Connect both users to the ConnectionManager
    await ws_manager.connect(ws_a, user_a_id)
    await ws_manager.connect(ws_b, user_b_id)

    # Check they are registered
    assert str(user_a_id) in ws_manager.active_connections
    assert str(user_b_id) in ws_manager.active_connections

    # 2. Send message to User A
    payload_a = {"type": "new_transaction", "amount": 100.0}
    await ws_manager.send_to_user(user_a_id, payload_a)

    # 3. Assert User A's websocket received the message
    ws_a.send_json.assert_called_once_with(payload_a)
    
    # Assert User B's websocket did NOT receive User A's message
    ws_b.send_json.assert_not_called()

    # Clean up connections
    ws_manager.disconnect(user_a_id)
    ws_manager.disconnect(user_b_id)
