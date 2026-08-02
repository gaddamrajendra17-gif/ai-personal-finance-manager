from sqlalchemy.orm import Session
from app.models.finance import Alert, Budget
from datetime import datetime


def create_alert(
    db: Session,
    user_id: str,
    alert_type: str,
    title: str,
    message: str,
    severity: str = "MEDIUM"
):
    """Create a new alert for a user."""
    alert = Alert(
        user_id=user_id,
        alert_type=alert_type,
        title=title,
        message=message,
        severity=severity,
    )
    db.add(alert)
    # Don't commit here — let the caller commit


def update_budget_on_transaction(
    user_id: str,
    category: str,
    amount: float,
    db: Session
):
    """Update spent amount in budget and trigger alert if exceeded."""
    now = datetime.utcnow()
    budget = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.category == category,
        Budget.month == now.month,
        Budget.year == now.year
    ).first()

    if not budget:
        return

    budget.spent_amount += amount

    if budget.spent_amount > budget.limit_amount:
        overage = budget.spent_amount - budget.limit_amount
        create_alert(
            db, user_id, "BUDGET_EXCEEDED",
            f"Budget exceeded for {category}",
            f"You've exceeded your {category} budget by ₹{overage:.2f} this month.",
            "HIGH"
        )
    elif budget.spent_amount >= budget.limit_amount * 0.85:
        remaining = budget.limit_amount - budget.spent_amount
        create_alert(
            db, user_id, "BUDGET_WARNING",
            f"Budget warning: {category}",
            f"You've used 85% of your {category} budget. ₹{remaining:.2f} remaining.",
            "MEDIUM"
        )
