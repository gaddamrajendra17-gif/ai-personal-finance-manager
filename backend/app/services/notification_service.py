from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.core.config import settings

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notif_type = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

def send_sms(to_number, message):
    account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
    auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
    from_number = getattr(settings, "TWILIO_PHONE_NUMBER", None)
    if not all([account_sid, auth_token, from_number]):
        print("SMS skipped: credentials missing")
        return {"success": False}
    if not account_sid or account_sid.startswith("your_"):
        print("SMS skipped: placeholder credentials")
        return {"success": False}
    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        msg = client.messages.create(body=message, from_=from_number, to=to_number)
        print(f"SMS sent: {msg.sid}")
        return {"success": True, "sid": msg.sid}
    except ImportError:
        print("twilio not installed")
        return {"success": False}
    except Exception as e:
        print(f"SMS failed: {e}")
        return {"success": False}

def create_notification(db, user_id, title, message, notif_type="info", send_sms_to=None):
    notif = Notification(user_id=user_id, title=title, message=message, notif_type=notif_type)
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Broadcast notification via WebSocket if loop is running
    import asyncio
    try:
        from app.api.notifications_api import manager as ws_manager
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(ws_manager.send_to_user(str(user_id), {
                "type": "notification",
                "notification": {
                    "id": notif.id,
                    "title": notif.title,
                    "message": notif.message,
                    "notif_type": notif.notif_type,
                    "is_read": notif.is_read,
                    "created_at": notif.created_at.isoformat()
                }
            }))
    except Exception:
        pass

    if send_sms_to:
        send_sms(send_sms_to, f"PFM Alert: {title}\n{message}")
    return notif

def notify_transaction(db, user_id, amount, category, description, phone=None):
    direction = "spent" if amount < 0 else "received"
    title = f"Transaction {direction.title()}"
    message = f"You {direction} Rs.{abs(amount):,.0f} on {category} - {description}"
    notif_type = "warning" if amount < 0 else "success"
    return create_notification(db, user_id, title, message, notif_type, phone)

def notify_budget_exceeded(db, user_id, category, spent, budget, phone=None):
    title = f"Budget Exceeded: {category}"
    message = f"You spent Rs.{spent:,.0f} of your Rs.{budget:,.0f} budget for {category}!"
    return create_notification(db, user_id, title, message, "danger", phone)

def notify_large_spend(db, user_id, amount, category, threshold=5000, phone=None):
    if abs(amount) >= threshold:
        title = "Large Transaction Alert"
        message = f"Large spend of Rs.{abs(amount):,.0f} detected in {category}"
        return create_notification(db, user_id, title, message, "warning", phone)
