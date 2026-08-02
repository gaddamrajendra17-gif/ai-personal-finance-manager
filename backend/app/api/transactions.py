from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Transaction, Account
from app.schemas.schemas import TransactionCreate, TransactionOut
from app.ai.categorizer import categorize_transaction
from app.ai.anomaly_detector import check_anomaly
from app.services.budget_service import update_budget_on_transaction
from app.services.alert_service import create_alert

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("/", response_model=List[TransactionOut])
def get_transactions(
    limit: int = Query(50, le=200),
    offset: int = 0,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all transactions for current user with optional filters."""
    account_ids = [a.id for a in current_user.accounts]
    query = db.query(Transaction).filter(Transaction.account_id.in_(account_ids))

    if category:
        query = query.filter(Transaction.category == category)
    if start_date:
        query = query.filter(Transaction.timestamp >= start_date)
    if end_date:
        query = query.filter(Transaction.timestamp <= end_date)

    return query.order_by(Transaction.timestamp.desc()).offset(offset).limit(limit).all()


@router.post("/", response_model=TransactionOut)
async def create_transaction(
    txn_data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually add a transaction."""
    account = db.query(Account).filter(
        Account.id == txn_data.account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # AI: Categorize
    category, subcategory = categorize_transaction(
        txn_data.merchant, txn_data.amount, txn_data.description
    )

    # AI: Anomaly Detection
    is_anomaly, anomaly_score = check_anomaly(
        str(current_user.id), txn_data.amount,
        txn_data.merchant, db
    )

    # Generate coordinate offsets for map visualization if not provided
    lat = txn_data.latitude
    lng = txn_data.longitude
    if txn_data.transaction_type == "DEBIT" and (lat is None or lng is None):
        import random
        from app.services.simulation_service import CHENNAI_CATEGORY_COORDS
        base_coord = CHENNAI_CATEGORY_COORDS.get(category) or CHENNAI_CATEGORY_COORDS.get("Other")
        lat = base_coord["lat"] + random.uniform(-0.015, 0.015)
        lng = base_coord["lng"] + random.uniform(-0.015, 0.015)

    txn = Transaction(
        account_id=txn_data.account_id,
        amount=txn_data.amount,
        merchant=txn_data.merchant,
        description=txn_data.description,
        transaction_type=txn_data.transaction_type,
        upi_ref=txn_data.upi_ref,
        timestamp=txn_data.timestamp,
        category=category,
        subcategory=subcategory,
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
        latitude=lat,
        longitude=lng,
    )
    db.add(txn)

    # Update budget tracking
    if txn_data.transaction_type == "DEBIT":
        update_budget_on_transaction(str(current_user.id), category, txn_data.amount, db)
        # Update account balance
        account.balance -= txn_data.amount
    else:
        account.balance += txn_data.amount

    if is_anomaly:
        create_alert(
            db, str(current_user.id), "ANOMALY",
            f"Unusual transaction at {txn_data.merchant}",
            f"A transaction of ₹{txn_data.amount:.2f} at {txn_data.merchant} looks suspicious.",
            "HIGH"
        )

    db.commit()
    db.refresh(txn)
    try:
        await broadcast_transaction({
            'id': str(txn.id),
            'amount': txn.amount if txn.transaction_type == 'CREDIT' else -abs(txn.amount),
            'merchant': txn.merchant,
            'category': txn.category,
            'transaction_type': txn.transaction_type,
            'timestamp': str(txn.timestamp),
            'latitude': txn.latitude,
            'longitude': txn.longitude,
        }, str(current_user.id))
    except Exception:
        pass
    return txn


@router.get("/summary/monthly", response_model=dict)
def get_monthly_summary(
    month: int = Query(datetime.now().month),
    year: int = Query(datetime.now().year),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get spending summary by category for a month."""
    account_ids = [a.id for a in current_user.accounts]

    results = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        func.extract("month", Transaction.timestamp) == month,
        func.extract("year", Transaction.timestamp) == year
    ).group_by(Transaction.category).all()

    return {
        "month": month, "year": year,
        "categories": [
            {"category": r.category or "Other", "total": float(r.total), "count": r.count}
            for r in results
        ],
        "total_spent": sum(float(r.total) for r in results)
    }


@router.get("/spending-trend", response_model=List[dict])
def get_spending_trend(
    days: int = Query(30, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get daily spending for trend chart."""
    from datetime import timedelta
    account_ids = [a.id for a in current_user.accounts]
    since = datetime.utcnow() - timedelta(days=days)

    results = db.query(
        func.date(Transaction.timestamp).label("date"),
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        Transaction.timestamp >= since
    ).group_by(func.date(Transaction.timestamp)).order_by("date").all()

    return [{"date": str(r.date), "amount": float(r.total)} for r in results]


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: str,
    txn_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account_ids = [a.id for a in current_user.accounts]
    txn = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.account_id.in_(account_ids)
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if "merchant" in txn_data: txn.merchant = txn_data["merchant"]
    if "amount" in txn_data: txn.amount = float(txn_data["amount"])
    if "category" in txn_data: txn.category = txn_data["category"]
    if "description" in txn_data: txn.description = txn_data["description"]
    db.commit()
    db.refresh(txn)
    return {"success": True, "id": str(txn.id)}


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account_ids = [a.id for a in current_user.accounts]
    txn = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.account_id.in_(account_ids)
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    account = db.query(Account).filter(Account.id == txn.account_id).first()
    if account:
        if txn.transaction_type == "DEBIT":
            account.balance += abs(txn.amount)
        else:
            account.balance -= abs(txn.amount)
    db.delete(txn)
    db.commit()
    return {"success": True, "message": "Transaction deleted"}


# Real-time broadcast helper
async def broadcast_transaction(txn_data: dict, user_id: str):
    try:
        from app.api.notifications_api import manager
        await manager.send_to_user(user_id, {
            "type": "new_transaction",
            "transaction": txn_data
        })
    except Exception as e:
        print(f"Broadcast failed: {e}")

