from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import RecurringTransaction, Account
from app.schemas.schemas import RecurringTransactionCreate, RecurringTransactionOut

router = APIRouter(prefix="/api/recurring", tags=["Recurring Transactions"])

@router.get("/", response_model=List[RecurringTransactionOut])
def get_recurring_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all recurring transactions for the current user."""
    return db.query(RecurringTransaction).filter(RecurringTransaction.user_id == current_user.id).all()

@router.get("/upcoming", response_model=List[RecurringTransactionOut])
def get_upcoming_recurring_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get active recurring transactions due in the next 3 days."""
    now = datetime.utcnow()
    three_days_from_now = now + timedelta(days=3)
    return db.query(RecurringTransaction).filter(
        RecurringTransaction.user_id == current_user.id,
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_date > now,
        RecurringTransaction.next_date <= three_days_from_now
    ).all()

@router.post("/", response_model=RecurringTransactionOut)
def create_recurring_transaction(
    payload: RecurringTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a recurring transaction configuration."""
    account = db.query(Account).filter(
        Account.id == payload.account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    recurring = RecurringTransaction(
        user_id=current_user.id,
        account_id=payload.account_id,
        merchant=payload.merchant,
        amount=payload.amount,
        category=payload.category,
        transaction_type=payload.transaction_type,
        frequency=payload.frequency,
        next_date=payload.next_date
    )
    db.add(recurring)
    db.commit()
    db.refresh(recurring)
    return recurring

@router.delete("/{recurring_id}")
def delete_recurring_transaction(
    recurring_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a recurring transaction configuration."""
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.user_id == current_user.id
    ).first()
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    db.delete(recurring)
    db.commit()
    return {"success": True, "message": "Recurring transaction deleted"}
