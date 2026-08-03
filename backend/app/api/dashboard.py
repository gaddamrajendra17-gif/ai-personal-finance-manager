from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Transaction, Account, Budget, Alert, SavingsGoal

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    account_ids = [a.id for a in current_user.accounts]

    # Total balance
    total_balance = db.query(func.sum(Account.balance)).filter(
        Account.user_id == current_user.id, Account.is_active == True
    ).scalar() or 0.0

    # All time total income from transactions
    total_income_txn = db.query(func.sum(Transaction.amount)).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "CREDIT"
    ).scalar() or 0.0

    # All time total spent
    total_spent_txn = db.query(func.sum(Transaction.amount)).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT"
    ).scalar() or 0.0

    # Monthly income and spent
    monthly_income_txn = db.query(func.sum(Transaction.amount)).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "CREDIT",
        Transaction.timestamp >= month_start
    ).scalar() or 0.0

    monthly_spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        Transaction.timestamp >= month_start
    ).scalar() or 0.0

    monthly_income = current_user.monthly_income or float(monthly_income_txn)
    monthly_savings = max(0, monthly_income - float(monthly_spent))
    total_savings = float(total_income_txn) - float(total_spent_txn)

    # Goals
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == current_user.id
    ).all()
    goals_data = [
        {
            "id": str(g.id),
            "goal_name": g.goal_name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "monthly_contribution": g.monthly_contribution,
            "percent": round((g.current_amount / g.target_amount * 100) if g.target_amount else 0, 1),
            "is_completed": g.is_completed,
            "deadline": str(g.deadline) if g.deadline else None,
        }
        for g in goals
    ]
    total_goal_target = sum(g.target_amount for g in goals)
    total_goal_saved = sum(g.current_amount for g in goals)

    # Top categories
    cat_results = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        Transaction.timestamp >= month_start
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).limit(6).all()
    top_categories = [{"category": r.category or "Other", "total": float(r.total)} for r in cat_results]

    # Spending trend last 7 days
    trend_results = db.query(
        func.date(Transaction.timestamp).label("date"),
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        Transaction.timestamp >= now - timedelta(days=7)
    ).group_by(func.date(Transaction.timestamp)).order_by("date").all()
    spending_trend = [{"date": str(r.date), "amount": float(r.total)} for r in trend_results]

    # Budget status
    budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == now.month,
        Budget.year == now.year
    ).all()
    budget_status = [
        {
            "category": b.category,
            "limit": b.limit_amount,
            "spent": b.spent_amount,
            "percent": round((b.spent_amount / b.limit_amount * 100) if b.limit_amount else 0, 1)
        }
        for b in budgets
    ]

    # Recent transactions
    recent = db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids)
    ).order_by(Transaction.timestamp.desc()).limit(10).all()
    recent_data = [
        {
            "id": str(t.id),
            "amount": t.amount if t.transaction_type == "CREDIT" else -abs(t.amount),
            "merchant": t.merchant,
            "category": t.category,
            "description": t.description,
            "transaction_type": t.transaction_type,
            "timestamp": str(t.timestamp),
            "created_at": str(t.created_at),
        }
        for t in recent
    ]

    # Unread alerts
    unread_alerts = db.query(func.count(Alert.id)).filter(
        Alert.user_id == current_user.id, Alert.is_read == False
    ).scalar() or 0

    return {
        "total_balance": float(total_balance),
        "total_income": float(total_income_txn),
        "total_spent": float(total_spent_txn),
        "total_savings": total_savings,
        "monthly_income": monthly_income,
        "monthly_spent": float(monthly_spent),
        "monthly_savings": monthly_savings,
        "monthly_income_txn": float(monthly_income_txn),
        "top_categories": top_categories,
        "spending_trend": spending_trend,
        "budget_status": budget_status,
        "recent_transactions": recent_data,
        "unread_alerts": unread_alerts,
        "goals": goals_data,
        "total_goal_target": total_goal_target,
        "total_goal_saved": total_goal_saved,
        "goals_count": len(goals),
        "goals_completed": sum(1 for g in goals if g.is_completed),
    }

