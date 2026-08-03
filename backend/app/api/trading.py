from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import TradingStrategy
from app.services.trading_service import TradingService

router = APIRouter(prefix="/api/trading", tags=["Algorithmic Trading"])

class BacktestRequest(BaseModel):
    symbol: str
    strategy_type: str  # SMA_CROSSOVER, MEAN_REVERSION, MOMENTUM
    params: str  # JSON parameters
    capital: Optional[float] = 100000.0

class StrategySubmit(BaseModel):
    name: str
    symbol: str
    strategy_type: str
    capital: float
    params: str

@router.post("/backtest")
def run_backtest(
    body: BacktestRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute a historical backtest of a strategy and return evaluation metrics."""
    res = TradingService.run_backtest(
        body.symbol,
        body.strategy_type,
        body.params,
        body.capital
    )
    if res.get("status") == "insufficient_data":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@router.get("/strategies")
def list_strategies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all strategies configured by the user."""
    strategies = db.query(TradingStrategy).filter(
        TradingStrategy.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "symbol": s.symbol,
            "strategy_type": s.strategy_type,
            "capital": s.capital,
            "cash": s.cash,
            "is_active": s.is_active,
            "params": s.params,
            "created_at": s.created_at
        }
        for s in strategies
    ]

@router.post("/strategies")
def create_strategy(
    body: StrategySubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a new algorithmic trading strategy configuration."""
    # Validate params JSON
    try:
        json.loads(body.params)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid params JSON string")
        
    strategy = TradingStrategy(
        user_id=current_user.id,
        name=body.name,
        symbol=body.symbol.upper(),
        strategy_type=body.strategy_type.upper(),
        capital=body.capital,
        cash=body.capital,
        is_active=False,
        params=body.params
    )
    
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    
    return {
        "status": "success",
        "strategy_id": str(strategy.id)
    }

@router.post("/strategies/{strategy_id}/toggle")
def toggle_strategy(
    strategy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle the execution state (start/stop) of a trading strategy."""
    strategy = db.query(TradingStrategy).filter(
        TradingStrategy.id == strategy_id,
        TradingStrategy.user_id == current_user.id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
        
    strategy.is_active = not strategy.is_active
    db.commit()
    
    return {
        "status": "success",
        "is_active": strategy.is_active
    }

@router.delete("/strategies/{strategy_id}")
def delete_strategy(
    strategy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a trading strategy."""
    strategy = db.query(TradingStrategy).filter(
        TradingStrategy.id == strategy_id,
        TradingStrategy.user_id == current_user.id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
        
    db.delete(strategy)
    db.commit()
    return {"status": "success"}

