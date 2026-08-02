from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import RoboProfile
from app.services.robo_advisor_service import RoboAdvisorService

router = APIRouter(prefix="/api/robo-advisor", tags=["Robo-Advisor"])

class ProfileSubmit(BaseModel):
    age: int
    horizon: int
    market_reaction: str  # sell_all, hold, buy_more
    monthly_investment_target: float
    financial_goal: Optional[str] = "General Wealth Building"

@router.post("/profile")
def submit_profile(
    body: ProfileSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculate and save user's risk and robo-advisory profile."""
    # Validate input
    if body.age <= 0 or body.horizon <= 0 or body.monthly_investment_target < 0:
        raise HTTPException(status_code=400, detail="Invalid profile parameters")
        
    metrics = RoboAdvisorService.calculate_risk_profile(
        body.age, body.horizon, body.market_reaction, body.financial_goal
    )
    
    profile = db.query(RoboProfile).filter(RoboProfile.user_id == current_user.id).first()
    if not profile:
        profile = RoboProfile(
            user_id=current_user.id,
            age=body.age,
            risk_tolerance=metrics["risk_category"],
            risk_score=metrics["risk_score"],
            investment_horizon=body.horizon,
            monthly_investment_target=body.monthly_investment_target,
            financial_goal=body.financial_goal
        )
        db.add(profile)
    else:
        profile.age = body.age
        profile.risk_tolerance = metrics["risk_category"]
        profile.risk_score = metrics["risk_score"]
        profile.investment_horizon = body.horizon
        profile.monthly_investment_target = body.monthly_investment_target
        profile.financial_goal = body.financial_goal
        
    db.commit()
    db.refresh(profile)
    
    return {
        "status": "success",
        "profile": {
            "risk_score": profile.risk_score,
            "risk_tolerance": profile.risk_tolerance,
            "investment_horizon": profile.investment_horizon,
            "monthly_investment_target": profile.monthly_investment_target
        }
    }

@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve the active RoboProfile."""
    profile = db.query(RoboProfile).filter(RoboProfile.user_id == current_user.id).first()
    if not profile:
        return {"configured": False}
        
    return {
        "configured": True,
        "age": profile.age,
        "risk_tolerance": profile.risk_tolerance,
        "risk_score": profile.risk_score,
        "investment_horizon": profile.investment_horizon,
        "monthly_investment_target": profile.monthly_investment_target,
        "financial_goal": profile.financial_goal
    }

@router.get("/plan")
def get_financial_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the full customized interactive asset allocation and growth projection plan."""
    return RoboAdvisorService.get_financial_plan(str(current_user.id), db)

@router.get("/recommendations")
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get customized spending reduction and investment allocation suggestions."""
    return RoboAdvisorService.get_personalized_recommendations(str(current_user.id), db)
