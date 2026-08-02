# app/services/budget_service.py
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.finance import Budget, Alert

def update_budget_on_transaction(user_id: str, category: str, amount: float, db: Session):
    """Update spent amount in budget and trigger alert if exceeded."""
    now = datetime.utcnow()
    budget = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.category == category,
        Budget.month == now.month,
        Budget.year == now.year
    ).first()

    if not budget:
        return None

    budget.spent_amount += amount

    # Check if budget is exceeded
    alert = None
    if budget.spent_amount > budget.limit_amount:
        overage = budget.spent_amount - budget.limit_amount
        alert = Alert(
            user_id=user_id,
            alert_type="BUDGET_EXCEEDED",
            title=f"Budget exceeded for {category}",
            message=f"You've exceeded your {category} budget by ₹{overage:.2f} this month.",
            severity="HIGH"
        )
        db.add(alert)

    db.commit()

    if alert:
        # Send real-time WebSocket alert
        import asyncio
        try:
            from app.api.notifications_api import manager as ws_manager
            asyncio.create_task(ws_manager.send_to_user(str(user_id), {
                "type": "budget_alert",
                "alert": {
                    "alert_type": "BUDGET_EXCEEDED",
                    "title": alert.title,
                    "message": alert.message,
                    "severity": alert.severity
                }
            }))
        except Exception:
            pass

    return alert
