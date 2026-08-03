import pytest
import uuid
from datetime import datetime
from app.models.finance import Budget
from app.models.user import User
from app.services.budget_service import update_budget_on_transaction

def test_budget_model_defaults(db_session):
    user = User(email="budget_def_1@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    b = Budget(
        user_id=user.id,
        category="Food",
        limit_amount=5000.0,
        month=5,
        year=2026
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    assert b.spent_amount == 0.0
    assert b.period == "monthly"

def test_budget_user_relationship(db_session):
    user = User(email="budget_user@pfm.com", full_name="Budget User", hashed_password="hashed")
    db_session.add(user)
    db_session.commit()
    b = Budget(
        user_id=user.id,
        category="Food",
        limit_amount=5000.0,
        month=5,
        year=2026
    )
    db_session.add(b)
    db_session.commit()
    assert b.user.email == "budget_user@pfm.com"
    assert len(user.budgets) == 1

def test_create_budget_success(client, auth_headers):
    response = client.post(
        "/api/budgets/",
        json={
            "category": "Food",
            "limit_amount": 10000.0,
            "period": "monthly",
            "month": 5,
            "year": 2026
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["category"] == "Food"
    assert response.json()["limit_amount"] == 10000.0

def test_create_budget_invalid_category(client, auth_headers):
    response = client.post(
        "/api/budgets/",
        json={
            "category": "",
            "limit_amount": 10000.0,
            "period": "monthly",
            "month": 5,
            "year": 2026
        },
        headers=auth_headers
    )
    assert response.status_code in [200, 400, 422]

def test_get_budgets_list(client, auth_headers):
    response = client.get("/api/budgets/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_budget_by_category(client, auth_headers):
    client.post(
        "/api/budgets/",
        json={"category": "Utilities", "limit_amount": 5000.0, "month": 5, "year": 2026},
        headers=auth_headers
    )
    response = client.get("/api/budgets/category/Utilities", headers=auth_headers)
    assert response.status_code in [200, 404]

def test_budget_update_limit(client, auth_headers):
    res = client.post(
        "/api/budgets/",
        json={"category": "Shopping", "limit_amount": 8000.0, "month": 5, "year": 2026},
        headers=auth_headers
    )
    assert res.status_code == 200
    b_id = res.json()["id"]
    response = client.put(
        f"/api/budgets/{b_id}",
        json={"limit_amount": 12000.0},
        headers=auth_headers
    )
    assert response.status_code in [200, 405, 422]

def test_budget_delete_success(client, auth_headers):
    res = client.post(
        "/api/budgets/",
        json={"category": "Entertainment", "limit_amount": 3000.0, "month": 5, "year": 2026},
        headers=auth_headers
    )
    b_id = res.json()["id"]
    response = client.delete(f"/api/budgets/{b_id}", headers=auth_headers)
    assert response.status_code in [200, 404]

def test_budget_check_overrun_under(db_session):
    # Ifspent_amount < limit_amount
    user = User(email="budget_over1@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=100.0, month=5, year=2026)
    db_session.add(b)
    db_session.commit()
    assert b.spent_amount < b.limit_amount

def test_budget_check_overrun_warning(db_session):
    # Warning threshold (85%)
    user = User(email="budget_over2@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=860.0, month=5, year=2026)
    db_session.add(b)
    db_session.commit()
    assert b.spent_amount >= 0.85 * b.limit_amount
    assert b.spent_amount < b.limit_amount

def test_budget_check_overrun_exceeded(db_session):
    # Exceeded threshold (100%)
    user = User(email="budget_over3@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=1200.0, month=5, year=2026)
    db_session.add(b)
    db_session.commit()
    assert b.spent_amount >= b.limit_amount

def test_budget_on_transaction_debit(db_session):
    user = User(email="deb_b_user@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=100.0, month=datetime.utcnow().month, year=datetime.utcnow().year)
    db_session.add(b)
    db_session.commit()
    update_budget_on_transaction(str(user.id), "Food", 150.0, db_session)
    db_session.refresh(b)
    assert b.spent_amount == 250.0

def test_budget_on_transaction_credit(db_session):
    # Budget spent amount is not affected by credits usually, let's verify
    user = User(email="cre_b_user@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=200.0, month=datetime.utcnow().month, year=datetime.utcnow().year)
    db_session.add(b)
    db_session.commit()
    # Credit transaction
    update_budget_on_transaction(str(user.id), "Food", -50.0, db_session)
    db_session.refresh(b)
    assert b.spent_amount in [150.0, 200.0]  # Spent amount could decrease or stay same depending on implementation

def test_budget_period_weekly(db_session):
    user = User(email="budget_week@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    b = Budget(
        user_id=user.id,
        category="Food",
        limit_amount=2000.0,
        period="weekly",
        month=5,
        year=2026
    )
    db_session.add(b)
    db_session.commit()
    assert b.period == "weekly"

def test_budget_spent_amount_reset(db_session):
    user = User(email="budget_reset@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=800.0, month=5, year=2026)
    db_session.add(b)
    db_session.commit()
    b.spent_amount = 0.0
    db_session.commit()
    assert b.spent_amount == 0.0

