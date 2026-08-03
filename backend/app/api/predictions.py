from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.ai.ml_predictor import predict_next_month

router = APIRouter(prefix="/api/predict", tags=["predictions"])

@router.get("/next-month")
def get_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return predict_next_month(current_user.id, db)

