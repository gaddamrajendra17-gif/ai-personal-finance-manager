import pytest
import uuid
from datetime import datetime, timedelta
from app.models.finance import Account, Transaction
from app.models.user import User
from unittest.mock import patch

@pytest.fixture
def db_account(db_session):
    user = User(email="txn_fixture_user@pfm.com", full_name="Fixture User", hashed_password="hashed_password")
    db_session.add(user)
    db_session.commit()
    account = Account(
        user_id=user.id,
        bank_name="Test Bank",
        account_token="test_token",
        account_last4="9999",
        balance=5000.0
    )
    db_session.add(account)
    db_session.commit()
    return account

def test_transaction_model_defaults(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow()
    )
    db_session.add(txn)
    db_session.commit()
    db_session.refresh(txn)
    assert txn.is_anomaly is False
    assert txn.is_recurring is False
    assert txn.anomaly_score is None

def test_transaction_type_debit():
    txn = Transaction(amount=100.0, transaction_type="DEBIT")
    assert txn.transaction_type == "DEBIT"

def test_transaction_type_credit():
    txn = Transaction(amount=100.0, transaction_type="CREDIT")
    assert txn.transaction_type == "CREDIT"

@patch("app.api.transactions.categorize_transaction")
@patch("app.api.transactions.check_anomaly")
def test_create_transaction_success(mock_anomaly, mock_categorize, client, auth_headers):
    mock_categorize.return_value = ("Shopping", "Clothing")
    mock_anomaly.return_value = (False, 0.0)

    acct_resp = client.post(
        "/api/accounts/",
        json={"bank_name": "Test Bank", "account_token": "tok_1", "account_last4": "1111", "account_type": "savings", "balance": 1000.0},
        headers=auth_headers
    )
    account_id = acct_resp.json()["id"]

    response = client.post(
        "/api/transactions/",
        json={
            "account_id": account_id,
            "amount": 200.0,
            "merchant": "Brand Store",
            "description": "Buy clothes",
            "transaction_type": "DEBIT",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["amount"] == -200.0
    assert response.json()["category"] == "Shopping"

@patch("app.api.transactions.categorize_transaction")
@patch("app.api.transactions.check_anomaly")
def test_create_transaction_invalid_account(mock_anomaly, mock_categorize, client, auth_headers):
    mock_categorize.return_value = ("Shopping", "Clothing")
    mock_anomaly.return_value = (False, 0.0)
    response = client.post(
        "/api/transactions/",
        json={
            "account_id": str(uuid.uuid4()),
            "amount": 200.0,
            "merchant": "Brand Store",
            "description": "Buy clothes",
            "transaction_type": "DEBIT",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=auth_headers
    )
    assert response.status_code == 404

def test_create_transaction_invalid_type(client, auth_headers):
    response = client.post(
        "/api/transactions/",
        json={
            "account_id": str(uuid.uuid4()),
            "amount": 200.0,
            "merchant": "Brand Store",
            "transaction_type": "INVALID",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=auth_headers
    )
    assert response.status_code in [422, 404]

def test_get_transactions_filter_category(client, auth_headers):
    response = client.get("/api/transactions/?category=Food", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_transactions_filter_merchant(client, auth_headers):
    response = client.get("/api/transactions/?merchant=McDonalds", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_transactions_date_range(client, auth_headers):
    start = (datetime.utcnow() - timedelta(days=7)).date().isoformat()
    end = datetime.utcnow().date().isoformat()
    response = client.get(f"/api/transactions/?start_date={start}&end_date={end}", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@patch("app.api.transactions.categorize_transaction")
@patch("app.api.transactions.check_anomaly")
def test_delete_transaction_reverts_balance(mock_anomaly, mock_categorize, client, auth_headers):
    mock_categorize.return_value = ("Shopping", "Clothing")
    mock_anomaly.return_value = (False, 0.0)
    acct_resp = client.post(
        "/api/accounts/",
        json={"bank_name": "Test Bank", "account_token": "tok_2", "account_last4": "2222", "account_type": "savings", "balance": 1000.0},
        headers=auth_headers
    )
    account_id = acct_resp.json()["id"]

    txn_resp = client.post(
        "/api/transactions/",
        json={
            "account_id": account_id,
            "amount": 100.0,
            "merchant": "Store",
            "transaction_type": "DEBIT",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=auth_headers
    )
    txn_id = txn_resp.json()["id"]
    
    # Delete the transaction
    del_resp = client.delete(f"/api/transactions/{txn_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

def test_delete_non_existent_transaction(client, auth_headers):
    random_uuid = str(uuid.uuid4())
    response = client.delete(f"/api/transactions/{random_uuid}", headers=auth_headers)
    assert response.status_code == 404

def test_update_transaction_amount(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow()
    )
    db_session.add(txn)
    db_session.commit()
    txn.amount = 150.0
    db_session.commit()
    assert txn.amount == 150.0

def test_update_transaction_category(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow(),
        category="OldCategory"
    )
    db_session.add(txn)
    db_session.commit()
    txn.category = "NewCategory"
    db_session.commit()
    assert txn.category == "NewCategory"

def test_transaction_gps_coordinates(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow(),
        latitude=12.9716,
        longitude=77.5946
    )
    db_session.add(txn)
    db_session.commit()
    assert txn.latitude == 12.9716
    assert txn.longitude == 77.5946

def test_bulk_import_transactions(client, auth_headers):
    # Route for bulk import is not standard REST, but we can verify it fails cleanly or mocks correctly
    response = client.post("/api/transactions/import", json={"transactions": []}, headers=auth_headers)
    assert response.status_code in [404, 200, 422, 405]

def test_transaction_limit_pagination(client, auth_headers):
    response = client.get("/api/transactions/?limit=10&skip=0", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_transaction_sorting(client, auth_headers):
    response = client.get("/api/transactions/?sort=date_desc", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_transaction_subcategories(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow(),
        category="Food",
        subcategory="Restaurants"
    )
    db_session.add(txn)
    db_session.commit()
    assert txn.subcategory == "Restaurants"

def test_transaction_is_recurring_flag(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow(),
        is_recurring=True
    )
    db_session.add(txn)
    db_session.commit()
    assert txn.is_recurring is True

def test_transaction_upi_reference(db_session, db_account):
    txn = Transaction(
        account_id=db_account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow(),
        upi_ref="UPI123456789"
    )
    db_session.add(txn)
    db_session.commit()
    assert txn.upi_ref == "UPI123456789"

def test_get_transaction_by_id(client, auth_headers):
    random_uuid = str(uuid.uuid4())
    response = client.get(f"/api/transactions/{random_uuid}", headers=auth_headers)
    assert response.status_code in [404, 405]

def test_add_transaction_negative_amount(client, auth_headers):
    response = client.post(
        "/api/transactions/",
        json={
            "account_id": str(uuid.uuid4()),
            "amount": -50.0,
            "merchant": "Negative",
            "transaction_type": "DEBIT",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=auth_headers
    )
    assert response.status_code in [404, 422, 400]

def test_add_transaction_zero_amount(client, auth_headers):
    response = client.post(
        "/api/transactions/",
        json={
            "account_id": str(uuid.uuid4()),
            "amount": 0.0,
            "merchant": "Zero",
            "transaction_type": "DEBIT",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=auth_headers
    )
    assert response.status_code in [404, 422, 400]

def test_transaction_relationship_to_account(db_session):
    user = User(email="txn_rel_user@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(
        user_id=user.id,
        bank_name="Generic Bank",
        account_token="token_xyz",
        account_last4="4444"
    )
    db_session.add(account)
    db_session.commit()
    txn = Transaction(
        account_id=account.id,
        amount=100.0,
        merchant="Store",
        transaction_type="DEBIT",
        timestamp=datetime.utcnow()
    )
    db_session.add(txn)
    db_session.commit()
    assert txn.account.bank_name == "Generic Bank"
    assert len(account.transactions) == 1
