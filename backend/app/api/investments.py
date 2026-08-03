from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.market_data_service import MarketDataService
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/api/investments", tags=["Investments"])

class TradeRequest(BaseModel):
    symbol: str
    quantity: float
    action: str  # BUY or SELL

@router.get("/tickers")
def get_tickers_overview(current_user: User = Depends(get_current_user)):
    """Fetch all simulated tickers with live prices and daily changes."""
    return MarketDataService.get_tickers_overview()

@router.get("/tickers/{symbol}/history")
def get_ticker_history(
    symbol: str,
    days: int = 180,
    current_user: User = Depends(get_current_user)
):
    """Fetch historical chart data (prices, volumes, indicators) for a symbol."""
    history = MarketDataService.get_historical_prices(symbol, days)
    if not history:
        raise HTTPException(status_code=404, detail="Ticker symbol not found")
    return history

@router.get("/portfolio")
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve simulated holdings summary, weights allocation, and risk ratios."""
    return PortfolioService.get_portfolio_summary(str(current_user.id), db)

@router.post("/trade")
def execute_trade(
    body: TradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Place a simulated BUY or SELL market order for an asset."""
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
        
    action = body.action.upper()
    symbol = body.symbol.upper()
    
    if action == "BUY":
        # Check cash balance or simulate
        # For simplicity, we assume users have unlimited virtual cash or we can deduce it from their accounts.
        # But we can verify if they have any linked simulated account and deduct from its balance!
        # This is a brilliant cognitive integration! Let's check if the user has a linked account and deduct or add!
        from app.models.finance import Account
        sim_account = db.query(Account).filter(
            Account.user_id == current_user.id,
            Account.account_token.like("simulated:%")
        ).first()
        
        price = MarketDataService.get_live_price(symbol)
        cost = price * body.quantity
        
        if sim_account and sim_account.balance < cost:
            raise HTTPException(status_code=400, detail=f"Insufficient funds in your simulated bank account ({sim_account.bank_name}) to purchase ₹{cost:,.2f} of {symbol}. Required balance: ₹{cost:,.2f}, Available: ₹{sim_account.balance:,.2f}")
            
        holding = PortfolioService.buy_asset(str(current_user.id), symbol, body.quantity, db)
        
        # Deduct balance if simulated account exists
        if sim_account:
            sim_account.balance -= cost
            db.commit()
            
        return {"status": "success", "message": f"Successfully purchased {body.quantity} shares of {symbol}", "holding": {"symbol": holding.symbol, "qty": holding.quantity}}
        
    elif action == "SELL":
        try:
            price = MarketDataService.get_live_price(symbol)
            revenue = price * body.quantity
            
            res = PortfolioService.sell_asset(str(current_user.id), symbol, body.quantity, db)
            
            # Credit balance to simulated account if exists
            from app.models.finance import Account
            sim_account = db.query(Account).filter(
                Account.user_id == current_user.id,
                Account.account_token.like("simulated:%")
            ).first()
            
            if sim_account:
                sim_account.balance += revenue
                db.commit()
                
            return {"status": "success", "message": f"Successfully sold {body.quantity} shares of {symbol}", "remaining": res["remaining_quantity"]}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Invalid trade action (must be BUY or SELL)")

