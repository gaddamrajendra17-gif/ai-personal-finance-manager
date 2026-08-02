from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import asyncio
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.notification_service import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket, user_id):
        await websocket.accept()
        self.active_connections[str(user_id)] = websocket

    def disconnect(self, user_id):
        self.active_connections.pop(str(user_id), None)

    async def send_to_user(self, user_id, data):
        ws = self.active_connections.get(str(user_id))
        if ws is not None:
            try:
                print(f"[WebSocket] Sending event of type '{data.get('type')}' to user {user_id}")
                await ws.send_json(data)
            except Exception as e:
                print(f"[WebSocket] Error sending to user {user_id}: {e}")
                self.disconnect(str(user_id))

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_notifications(websocket: WebSocket, user_id: str):
    print(f"[WebSocket] Connecting client: {user_id}")
    await manager.connect(websocket, user_id)
    print(f"[WebSocket] Connected client: {user_id}")
    try:
        await websocket.send_json({"type": "connected", "message": "Connected"})
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        print(f"[WebSocket] Disconnected client: {user_id}")
        manager.disconnect(user_id)

@router.get("/")
def get_notifications(limit: int = 20, unread_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [{"id": n.id, "title": n.title, "message": n.message, "type": n.notif_type, "is_read": n.is_read, "created_at": n.created_at.isoformat()} for n in notifications]

@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).count()
    return {"count": count}

@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"success": True}

@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}

@router.delete("/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).delete()
    db.commit()
    return {"success": True}

@router.get("/mock-emails")
def get_simulated_emails(current_user: User = Depends(get_current_user)):
    """Retrieve simulated emails from mock_emails.json."""
    from app.services.email_service import get_mock_emails
    return get_mock_emails()

@router.post("/mock-emails/clear")
def clear_simulated_emails(current_user: User = Depends(get_current_user)):
    """Clear simulated emails."""
    from app.services.email_service import clear_mock_emails
    clear_mock_emails()
    return {"success": True, "message": "Simulated inbox cleared."}
