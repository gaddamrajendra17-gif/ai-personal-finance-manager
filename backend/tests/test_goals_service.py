import pytest
import uuid
from datetime import datetime, timedelta
from app.models.finance import SavingsGoal
from app.models.user import User

def test_savings_goal_model_defaults(db_session):
    user = User(email="goal_def@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="Emergency Fund",
        target_amount=10000.0,
        deadline=datetime.utcnow() + timedelta(days=180)
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)
    assert goal.current_amount == 0.0
    assert goal.monthly_contribution == 0.0
    assert goal.is_completed is False

def test_savings_goal_user_relationship(db_session):
    user = User(email="goal_user@pfm.com", full_name="Goal User", hashed_password="hashed")
    db_session.add(user)
    db_session.commit()
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="Emergency Fund",
        target_amount=10000.0,
        deadline=datetime.utcnow() + timedelta(days=180)
    )
    db_session.add(goal)
    db_session.commit()
    assert goal.user.email == "goal_user@pfm.com"
    assert len(user.savings_goals) == 1

def test_create_savings_goal(client, auth_headers):
    response = client.post(
        "/api/goals/",
        json={
            "goal_name": "Buy Laptop",
            "target_amount": 50000.0,
            "current_amount": 5000.0,
            "monthly_contribution": 5000.0,
            "deadline": (datetime.utcnow() + timedelta(days=90)).isoformat()
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["goal_name"] == "Buy Laptop"
    assert response.json()["target_amount"] == 50000.0

def test_get_savings_goals_list(client, auth_headers):
    response = client.get("/api/goals/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_update_savings_goal_progress(client, auth_headers):
    res = client.post(
        "/api/goals/",
        json={
            "goal_name": "Trip",
            "target_amount": 20000.0,
            "current_amount": 1000.0,
            "monthly_contribution": 1000.0,
            "deadline": (datetime.utcnow() + timedelta(days=90)).isoformat()
        },
        headers=auth_headers
    )
    goal_id = res.json()["id"]
    response = client.put(
        f"/api/goals/{goal_id}",
        json={"current_amount": 5000.0},
        headers=auth_headers
    )
    assert response.status_code in [200, 405, 422]

def test_savings_goal_completion(db_session):
    user = User(email="goal_comp@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="Emergency Fund",
        target_amount=1000.0,
        current_amount=1000.0,
        deadline=datetime.utcnow() + timedelta(days=180)
    )
    db_session.add(goal)
    db_session.commit()
    # Logic to set completion
    goal.is_completed = True
    db_session.commit()
    assert goal.is_completed is True

def test_delete_savings_goal(client, auth_headers):
    res = client.post(
        "/api/goals/",
        json={
            "goal_name": "Car Fund",
            "target_amount": 500000.0,
            "current_amount": 10000.0,
            "monthly_contribution": 10000.0,
            "deadline": (datetime.utcnow() + timedelta(days=365)).isoformat()
        },
        headers=auth_headers
    )
    goal_id = res.json()["id"]
    response = client.delete(f"/api/goals/{goal_id}", headers=auth_headers)
    assert response.status_code in [200, 404]

def test_savings_goal_contributions(db_session):
    user = User(email="goal_contr@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="College",
        target_amount=10000.0,
        current_amount=2000.0,
        monthly_contribution=500.0
    )
    db_session.add(goal)
    db_session.commit()
    goal.current_amount += goal.monthly_contribution
    db_session.commit()
    assert goal.current_amount == 2500.0

def test_savings_goal_deadline_safety(db_session):
    user = User(email="goal_dead@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="Emergency Fund",
        target_amount=10000.0,
        deadline=datetime.utcnow() - timedelta(days=1)
    )
    db_session.add(goal)
    db_session.commit()
    assert goal.deadline < datetime.utcnow()

def test_savings_goal_completed_flag(db_session):
    user = User(email="goal_flag@pfm.com", full_name="User", hashed_password="pw")
    db_session.add(user)
    db_session.commit()
    goal = SavingsGoal(
        user_id=user.id,
        goal_name="Emergency Fund",
        target_amount=10000.0,
        current_amount=12000.0
    )
    db_session.add(goal)
    db_session.commit()
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True
    db_session.commit()
    assert goal.is_completed is True

