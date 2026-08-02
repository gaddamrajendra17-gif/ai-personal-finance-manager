import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.core.config import settings
from app.models.finance import Transaction, Account
from app.schemas.schemas import WebhookTransaction
from app.ai.categorizer import categorize_transaction
from app.ai.anomaly_detector import check_anomaly
from app.services.alert_service import create_alert
from app.services.budget_service import update_budget_on_transaction

router = APIRouter(prefix="/api/webhook", tags=["Webhooks"])


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 signature from bank/Setu."""
    expected = hmac.new(
        settings.WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def process_transaction_async(
    txn_data: WebhookTransaction,
    db: Session
):
    """Background task: process incoming webhook transaction."""
    # Find account by token
    account = db.query(Account).filter(
        Account.account_token == txn_data.account_token
    ).first()

    if not account:
        return  # Unknown account, ignore

    # Parse timestamp
    try:
        ts = datetime.fromisoformat(txn_data.timestamp.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.utcnow()

    # AI: Categorize
    category, subcategory = categorize_transaction(
        txn_data.merchant, txn_data.amount, txn_data.description
    )

    # AI: Anomaly Detection
    user_id = str(account.user_id)
    is_anomaly, anomaly_score = check_anomaly(user_id, txn_data.amount, txn_data.merchant, db)

    txn = Transaction(
        account_id=account.id,
        amount=txn_data.amount,
        merchant=txn_data.merchant,
        description=txn_data.description,
        transaction_type=txn_data.type,
        upi_ref=txn_data.upi_ref,
        timestamp=ts,
        category=category,
        subcategory=subcategory,
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
    )
    db.add(txn)

    # Update balances
    if txn_data.type == "DEBIT":
        account.balance = max(0, account.balance - txn_data.amount)
        update_budget_on_transaction(user_id, category, txn_data.amount, db)
    else:
        account.balance += txn_data.amount

    if is_anomaly:
        create_alert(
            db, user_id, "ANOMALY",
            f"Suspicious transaction at {txn_data.merchant}",
            f"Transaction of ₹{txn_data.amount:.2f} looks unusual. Score: {anomaly_score:.2f}",
            "HIGH"
        )

    db.commit()


@router.post("/transaction")
async def receive_transaction(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receive real-time transaction from bank/Setu webhook.
    
    Sample payload:
    {
        "txn_id": "UPI20260220001",
        "amount": 450.00,
        "merchant": "Swiggy",
        "timestamp": "2026-02-20T14:30:00Z",
        "account_token": "ACC_TOKEN_123",
        "type": "DEBIT",
        "upi_ref": "826012345678"
    }
    """
    body = await request.body()
    signature = request.headers.get("X-Webhook-Signature", "")

    # Verify signature (skip in development)
    if settings.ENVIRONMENT == "production":
        if not verify_webhook_signature(body, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    payload = json.loads(body)
    txn_data = WebhookTransaction(**payload)

    # Process in background to return 200 immediately
    background_tasks.add_task(process_transaction_async, txn_data, db)

    return {"status": "received", "txn_id": txn_data.txn_id}
