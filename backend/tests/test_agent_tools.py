import pytest
import uuid
from datetime import datetime
from app.models.finance import Account, Transaction, Budget, SavingsGoal, Holding
from app.models.user import User
from app.ai.agent import (
    run_tool_create_budget,
    run_tool_create_transaction,
    run_tool_get_budgets,
    run_tool_get_transactions,
    run_fallback_agent
)

@pytest.mark.asyncio
async def test_run_tool_create_budget(db_session):
    user = User(email="agent1@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    
    res = run_tool_create_budget(db_session, str(user.id), "Food & Dining", 6000.0)
    assert res["status"] == "success"
    assert res["data"]["category"] == "Food & Dining"
    assert res["data"]["limit_amount"] == 6000.0

    # Query directly
    budget = db_session.query(Budget).filter(Budget.user_id == user.id).first()
    assert budget is not None
    assert budget.limit_amount == 6000.0


@pytest.mark.asyncio
async def test_run_tool_create_transaction(db_session):
    user = User(email="agent2@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    
    account = Account(user_id=user.id, bank_name="Sim Bank", account_token="simulated:checking", balance=50000.0)
    db_session.add(account)
    db_session.commit()
    
    res = await run_tool_create_transaction(
        db_session, str(user.id), 250.0, "Starbucks", "DEBIT", "Morning Coffee"
    )
    assert res["status"] == "success"
    assert res["data"]["amount"] == 250.0
    assert res["data"]["merchant"] == "Starbucks"
    
    # Check balance deduction
    db_session.refresh(account)
    assert account.balance == 49750.0


@pytest.mark.asyncio
async def test_fallback_agent_budget_intent(db_session):
    user = User(email="agent3@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    
    response, thoughts, actions = await run_fallback_agent(
        "set a budget of 4500 for Food", str(user.id), db_session
      )
    assert "Food & Dining" in response
    assert len(actions) == 1
    assert actions[0]["tool"] == "create_budget"
    assert actions[0]["arguments"]["limit_amount"] == 4500.0


@pytest.mark.asyncio
async def test_fallback_agent_transaction_intent(db_session):
    user = User(email="agent4@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    
    account = Account(user_id=user.id, bank_name="Sim Bank", account_token="simulated:checking", balance=1000.0)
    db_session.add(account)
    db_session.commit()
    
    response, thoughts, actions = await run_fallback_agent(
        "spent 150 at Uber", str(user.id), db_session
      )
    assert "Uber" in response
    assert len(actions) == 1
    assert actions[0]["tool"] == "create_transaction"
    assert actions[0]["arguments"]["amount"] == 150.0
    
    db_session.refresh(account)
    assert account.balance == 850.0

