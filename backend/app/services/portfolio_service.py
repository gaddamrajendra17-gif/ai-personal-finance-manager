from sqlalchemy.orm import Session
from app.models.finance import Holding, InvestmentTransaction, RoboProfile
from app.services.market_data_service import MarketDataService
from typing import Dict, List
import datetime

# Asset Betas and Volatilities for Risk Calculation
ASSET_METRICS = {
    "RELIANCE": {"beta": 1.15, "volatility": 0.18, "type": "Equities"},
    "TCS": {"beta": 0.95, "volatility": 0.14, "type": "Equities"},
    "HDFCBANK": {"beta": 0.85, "volatility": 0.13, "type": "Debt"},
    "INFY": {"beta": 1.20, "volatility": 0.19, "type": "Equities"},
    "NIFTY50": {"beta": 1.00, "volatility": 0.11, "type": "Equities"},
    "GOLD": {"beta": 0.05, "volatility": 0.08, "type": "Gold"},
    "CASH": {"beta": 0.00, "volatility": 0.00, "type": "Cash"}
}

class PortfolioService:
    @staticmethod
    def buy_asset(user_id: str, symbol: str, quantity: float, db: Session) -> Holding:
        """Buy asset, adjust holdings, and record transaction."""
        symbol = symbol.upper()
        current_price = MarketDataService.get_live_price(symbol)
        
        # Resolve Asset Name and Type
        tickers_overview = MarketDataService.get_tickers_overview()
        name = next((t["name"] for t in tickers_overview if t["symbol"] == symbol), symbol)
        asset_type = ASSET_METRICS.get(symbol, {}).get("type", "Equities")
        
        # Record Investment Transaction
        txn = InvestmentTransaction(
            user_id=user_id,
            symbol=symbol,
            name=name,
            asset_type=asset_type,
            quantity=quantity,
            price=current_price,
            transaction_type="BUY"
        )
        db.add(txn)
        
        # Update or Create Holding
        holding = db.query(Holding).filter(
            Holding.user_id == user_id,
            Holding.symbol == symbol
        ).first()
        
        if not holding:
            holding = Holding(
                user_id=user_id,
                symbol=symbol,
                name=name,
                asset_type=asset_type,
                quantity=quantity,
                avg_buy_price=current_price,
                current_price=current_price
            )
            db.add(holding)
        else:
            # Re-calculate average buy price
            total_cost = (holding.quantity * holding.avg_buy_price) + (quantity * current_price)
            new_qty = holding.quantity + quantity
            holding.avg_buy_price = round(total_cost / new_qty, 2)
            holding.quantity = new_qty
            holding.current_price = current_price
            
        db.commit()
        db.refresh(holding)
        return holding

    @staticmethod
    def sell_asset(user_id: str, symbol: str, quantity: float, db: Session) -> Dict:
        """Sell asset, check balance, and record transaction."""
        symbol = symbol.upper()
        holding = db.query(Holding).filter(
            Holding.user_id == user_id,
            Holding.symbol == symbol
        ).first()
        
        if not holding or holding.quantity < quantity:
            raise ValueError(f"Insufficient holdings of {symbol}")
            
        current_price = MarketDataService.get_live_price(symbol)
        
        # Record Transaction
        txn = InvestmentTransaction(
            user_id=user_id,
            symbol=symbol,
            name=holding.name,
            asset_type=holding.asset_type,
            quantity=quantity,
            price=current_price,
            transaction_type="SELL"
        )
        db.add(txn)
        
        # Update Holding
        holding.quantity -= quantity
        holding.current_price = current_price
        
        # Delete if quantity drops to 0
        if holding.quantity <= 0.0001:
            db.delete(holding)
            holding = None
            
        db.commit()
        return {"status": "success", "remaining_quantity": holding.quantity if holding else 0}

    @staticmethod
    def get_portfolio_summary(user_id: str, db: Session) -> Dict:
        """Fetch portfolio holdings, valuation, and risk metrics."""
        holdings = db.query(Holding).filter(Holding.user_id == user_id).all()
        
        total_cost = 0.0
        total_value = 0.0
        
        holdings_list = []
        asset_weights = {"Equities": 0.0, "Debt": 0.0, "Gold": 0.0, "Cash": 0.0}
        
        # Metrics for Sharpe / Beta calculations
        weighted_beta = 0.0
        weighted_vol = 0.0
        
        for h in holdings:
            live_price = MarketDataService.get_live_price(h.symbol)
            # Update current price in DB
            h.current_price = live_price
            
            value = h.quantity * live_price
            cost = h.quantity * h.avg_buy_price
            pnl = value - cost
            pnl_percent = (pnl / cost * 100) if cost > 0 else 0.0
            
            total_cost += cost
            total_value += value
            
            metrics = ASSET_METRICS.get(h.symbol, {"beta": 1.0, "volatility": 0.15, "type": "Equities"})
            asset_weights[h.asset_type] = asset_weights.get(h.asset_type, 0.0) + value
            
            holdings_list.append({
                "id": str(h.id),
                "symbol": h.symbol,
                "name": h.name,
                "asset_type": h.asset_type,
                "quantity": h.quantity,
                "avg_buy_price": h.avg_buy_price,
                "current_price": live_price,
                "value": round(value, 2),
                "cost": round(cost, 2),
                "pnl": round(pnl, 2),
                "pnl_percent": round(pnl_percent, 2),
                "beta": metrics["beta"],
                "volatility": metrics["volatility"]
            })
            
        db.commit() # Save live prices updates
        
        # Calculate percentages and portfolio risk parameters
        if total_value > 0:
            for k in asset_weights:
                asset_weights[k] = round((asset_weights[k] / total_value) * 100, 2)
                
            for h in holdings_list:
                weight = h["value"] / total_value
                weighted_beta += h["beta"] * weight
                weighted_vol += h["volatility"] * weight
        else:
            asset_weights = {"Equities": 0.0, "Debt": 0.0, "Gold": 0.0, "Cash": 100.0}
            weighted_beta = 0.0
            weighted_vol = 0.0
            
        total_pnl = total_value - total_cost
        total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0.0
        
        # Calculate Sharpe Ratio (Risk Free Rate = 5%, portfolio return assumed as P&L percent / 100 or default to 8%)
        risk_free = 0.05
        portfolio_return = max(0.0, total_pnl_percent / 100) if total_cost > 0 else 0.08
        portfolio_vol = max(0.01, weighted_vol)
        sharpe = (portfolio_return - risk_free) / portfolio_vol
        
        # Herfindahl-Hirschman Index for diversification
        hhi = 0.0
        if total_value > 0:
            for h in holdings_list:
                hhi += (h["value"] / total_value) ** 2
        diversification_score = round(100 * (1 - hhi), 1) if total_value > 0 else 100.0
        
        # Compare with Robo Profile risk
        profile = db.query(RoboProfile).filter(RoboProfile.user_id == user_id).first()
        risk_warning = False
        warning_msg = ""
        
        if profile and total_value > 0:
            equities_pct = asset_weights.get("Equities", 0.0)
            if profile.risk_tolerance == "CONSERVATIVE" and equities_pct > 40.0:
                risk_warning = True
                warning_msg = "Your equity allocation is significantly higher than recommended for a Conservative risk profile."
            elif profile.risk_tolerance == "MODERATE" and equities_pct > 70.0:
                risk_warning = True
                warning_msg = "Your equity exposure is higher than the typical Moderate portfolio threshold."
                
        return {
            "total_value": round(total_value, 2),
            "total_cost": round(total_cost, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_percent": round(total_pnl_percent, 2),
            "holdings": holdings_list,
            "allocation_percentages": asset_weights,
            "portfolio_beta": round(weighted_beta, 2),
            "portfolio_volatility": round(weighted_vol * 100, 2), # In percent
            "sharpe_ratio": round(sharpe, 2),
            "diversification_score": diversification_score,
            "risk_warning": risk_warning,
            "risk_warning_message": warning_msg
        }
