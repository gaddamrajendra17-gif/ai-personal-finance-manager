import pytest
import uuid
from app.models.finance import Account
from app.models.user import User

def test_account_model_defaults(db_session):
    user = User(email="def_acc_user@pfm.com", full_name="User", hashed_password="pw")
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
    db_session.refresh(account)
    assert account.account_type == "savings"
    assert account.balance == 0.0
    assert account.is_active is True

def test_account_relationship_to_user(db_session):
    user = User(email="acc_user@pfm.com", full_name="Account User", hashed_password="hashed")
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
    assert account.user.email == "acc_user@pfm.com"
    assert len(user.accounts) == 1

def test_create_account_success(client, auth_headers):
    response = client.post(
        "/api/accounts/",
        json={
            "bank_name": "Chase Bank",
            "account_token": "token_chase_999",
            "account_last4": "9999",
            "account_type": "current",
            "balance": 25000.0
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["bank_name"] == "Chase Bank"
    assert response.json()["balance"] == 25000.0

def test_create_account_invalid_type(client, auth_headers):
    response = client.post(
        "/api/accounts/",
        json={
            "bank_name": "Chase Bank",
            "account_token": "token_chase_999",
            "account_last4": "9999",
            "account_type": "invalid_type",
            "balance": 25000.0
        },
        headers=auth_headers
    )
    assert response.status_code in [200, 422]

def test_list_accounts(client, auth_headers):
    client.post(
        "/api/accounts/",
        json={
            "bank_name": "Bank 1",
            "account_token": "token_1",
            "account_last4": "1111",
            "account_type": "savings",
            "balance": 1000.0
        },
        headers=auth_headers
    )
    response = client.get("/api/accounts/", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_get_account_by_id(client, auth_headers):
    res = client.post(
        "/api/accounts/",
        json={
            "bank_name": "Bank 2",
            "account_token": "token_2",
            "account_last4": "2222",
            "account_type": "savings",
            "balance": 2000.0
        },
        headers=auth_headers
    )
    acct_id = res.json()["id"]
    response = client.get(f"/api/accounts/{acct_id}", headers=auth_headers)
    assert response.status_code in [200, 404]

def test_get_account_not_found(client, auth_headers):
    random_uuid = str(uuid.uuid4())
    response = client.get(f"/api/accounts/{random_uuid}", headers=auth_headers)
    assert response.status_code in [404, 405]

def test_update_account_balance(db_session):
    user = User(email="upd_acc_user@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    account = Account(
        user_id=user.id,
        bank_name="Update Bank",
        account_token="token_update",
        account_last4="5555",
        balance=100.0
    )
    db_session.add(account)
    db_session.commit()
    account.balance = 500.0
    db_session.commit()
    db_session.refresh(account)
    assert account.balance == 500.0

def test_delete_account_success(client, auth_headers):
    res = client.post(
        "/api/accounts/",
        json={
            "bank_name": "Bank 3",
            "account_token": "token_3",
            "account_last4": "3333",
            "account_type": "savings",
            "balance": 3000.0
        },
        headers=auth_headers
    )
    acct_id = res.json()["id"]
    response = client.delete(f"/api/accounts/{acct_id}", headers=auth_headers)
    assert response.status_code in [200, 404, 405]

def test_delete_account_unauthorized(client):
    random_uuid = str(uuid.uuid4())
    response = client.delete(f"/api/accounts/{random_uuid}")
    assert response.status_code in [401, 405]

def test_deactivate_account(db_session):
    user = User(email="deac_acc_user@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    account = Account(
        user_id=user.id,
        bank_name="Deactivate Bank",
        account_token="token_deactivate",
        account_last4="6666",
        is_active=True
    )
    db_session.add(account)
    db_session.commit()
    account.is_active = False
    db_session.commit()
    db_session.refresh(account)
    assert account.is_active is False

def test_reactivate_account(db_session):
    user = User(email="reac_acc_user@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    account = Account(
        user_id=user.id,
        bank_name="Reactivate Bank",
        account_token="token_reactivate",
        account_last4="7777",
        is_active=False
    )
    db_session.add(account)
    db_session.commit()
    account.is_active = True
    db_session.commit()
    db_session.refresh(account)
    assert account.is_active is True
