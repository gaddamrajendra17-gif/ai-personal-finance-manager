from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Alert
from app.schemas.schemas import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("/", response_model=List[AlertOut])
def get_alerts(
    unread_only: bool = False,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Alert).filter(Alert.user_id == current_user.id)
    if unread_only:
        query = query.filter(Alert.is_read == False)
    return query.order_by(Alert.created_at.desc()).limit(limit).all()


@router.put("/{alert_id}/read")
def mark_read(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(
        Alert.id == alert_id, Alert.user_id == current_user.id
    ).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"status": "ok"}


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Alert).filter(
        Alert.user_id == current_user.id, Alert.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}
