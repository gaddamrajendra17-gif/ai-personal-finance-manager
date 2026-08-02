from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import SavingsStrategy, Account, SavingsGoal
from app.services.savings_service import SavingsService

router = APIRouter(prefix="/api/savings", tags=["Automated Savings"])

class StrategyCreate(BaseModel):
    plan_name: str
    source_account_id: str
    destination_goal_id: str
    transfer_amount: float
    frequency: Optional[str] = "monthly"

@router.get("/strategies")
def get_strategies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all automated savings transfer strategies for the user."""
    strategies = db.query(SavingsStrategy).filter(
        SavingsStrategy.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": str(s.id),
            "plan_name": s.plan_name,
            "source_account": s.source_account.bank_name if s.source_account else "Unknown Bank",
            "destination_goal": s.destination_goal.goal_name if s.destination_goal else "General Goal",
            "transfer_amount": s.transfer_amount,
            "frequency": s.frequency,
            "status": s.status,
            "created_at": s.created_at
        }
        for s in strategies
    ]

@router.post("/strategies")
def create_strategy(
    body: StrategyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new checking-to-savings automated transfer strategy."""
    # Verify account and goal exist and belong to user
    account = db.query(Account).filter(
        Account.id == body.source_account_id,
        Account.user_id == current_user.id
    ).first()
    
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == body.destination_goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not account or not goal:
        raise HTTPException(status_code=404, detail="Source Account or Destination Goal not found")
        
    if body.transfer_amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be greater than zero")
        
    strategy = SavingsStrategy(
        user_id=current_user.id,
        plan_name=body.plan_name,
        source_account_id=uuid.UUID(body.source_account_id),
        destination_goal_id=uuid.UUID(body.destination_goal_id),
        transfer_amount=body.transfer_amount,
        frequency=body.frequency,
        status="ACTIVE"
    )
    
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    
    return {"status": "success", "strategy_id": str(strategy.id)}

@router.post("/strategies/{strategy_id}/toggle")
def toggle_strategy(
    strategy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle strategy ACTIVE / PAUSED status."""
    strategy = db.query(SavingsStrategy).filter(
        SavingsStrategy.id == strategy_id,
        SavingsStrategy.user_id == current_user.id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy plan not found")
        
    strategy.status = "PAUSED" if strategy.status == "ACTIVE" else "ACTIVE"
    db.commit()
    return {"status": "success", "new_status": strategy.status}

@router.post("/strategies/trigger")
def trigger_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Simulate execution of active automated transfers immediately."""
    return SavingsService.run_automated_transfers(db, str(current_user.id))

@router.get("/recommendations")
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cashflow-based savings goal contribution adjustments recommendations."""
    return SavingsService.get_goal_recommendations(str(current_user.id), db)

@router.delete("/strategies/{strategy_id}")
def delete_strategy(
    strategy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a strategy."""
    strategy = db.query(SavingsStrategy).filter(
        SavingsStrategy.id == strategy_id,
        SavingsStrategy.user_id == current_user.id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
        
    db.delete(strategy)
    db.commit()
    return {"status": "success"}

class SweepRequest(BaseModel):
    account_id: str
    goal_id: str
    amount: float

@router.post("/sweep")
def execute_savings_sweep(
    body: SweepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a one-time cash flow sweep transfer from checking account to savings goal."""
    account = db.query(Account).filter(
        Account.id == body.account_id,
        Account.user_id == current_user.id
    ).first()
    
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == body.goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not account or not goal:
        raise HTTPException(status_code=404, detail="Account or Goal not found")
        
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Sweep amount must be greater than zero")
        
    if account.balance < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance in checking account")
        
    # Transfer
    account.balance -= body.amount
    goal.current_amount += body.amount
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True
        
    # Record DEBIT Transaction
    from app.models.finance import Transaction
    from app.services.budget_service import update_budget_on_transaction
    from app.services.notification_service import create_notification
    import datetime
    
    txn = Transaction(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=body.amount,
        merchant="AI Cash-Flow Sweep",
        description=f"AI-guided surplus sweep to goal: {goal.goal_name}",
        category="Investments",
        subcategory="Savings Sweep",
        transaction_type="DEBIT",
        timestamp=datetime.datetime.utcnow(),
        is_anomaly=False,
        anomaly_score=0.0
    )
    db.add(txn)
    update_budget_on_transaction(str(current_user.id), "Investments", body.amount, db)
    
    create_notification(
        db, current_user.id,
        "💡 AI Sweep Executed",
        f"Transferred ₹{body.amount:,.2f} surplus from '{account.bank_name}' to savings goal '{goal.goal_name}'.",
        "success"
    )
    
    db.commit()
    return {"status": "success", "new_balance": account.balance, "new_goal_amount": goal.current_amount}
