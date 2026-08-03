from sqlalchemy.orm import Session
from app.models.finance import RoboProfile, Transaction, Account, Budget
from app.services.market_data_service import MarketDataService
from typing import Dict, List
import datetime
from sqlalchemy import func

class RoboAdvisorService:
    @staticmethod
    def calculate_risk_profile(age: int, horizon: int, market_reaction: str, goal: str) -> Dict:
        """
        Calculate risk score (1-100) and risk category.
        market_reaction: "sell_all" (low risk), "hold" (medium), "buy_more" (high)
        """
        score = 50
        
        # Age component (younger users can take more risk)
        if age < 30:
            score += 15
        elif age < 45:
            score += 5
        elif age > 60:
            score -= 15
            
        # Horizon component (longer horizon = higher risk tolerance)
        if horizon > 8:
            score += 15
        elif horizon > 3:
            score += 5
        else:
            score -= 10
            
        # Market reaction (crucial psychological indicator)
        if market_reaction == "buy_more":
            score += 20
        elif market_reaction == "sell_all":
            score -= 20
            
        # Clamp score between 1 and 100
        score = max(1, min(100, score))
        
        if score <= 35:
            category = "CONSERVATIVE"
        elif score <= 70:
            category = "MODERATE"
        else:
            category = "AGGRESSIVE"
            
        return {
            "risk_score": score,
            "risk_category": category
        }

    @staticmethod
    def get_allocation_mix(category: str) -> Dict[str, float]:
        """Return percentage allocations for asset types."""
        if category == "CONSERVATIVE":
            return {"Equities": 20.0, "Debt": 60.0, "Gold": 10.0, "Cash": 10.0}
        elif category == "MODERATE":
            return {"Equities": 50.0, "Debt": 35.0, "Gold": 10.0, "Cash": 5.0}
        else: # AGGRESSIVE
            return {"Equities": 80.0, "Debt": 10.0, "Gold": 5.0, "Cash": 5.0}

    @staticmethod
    def get_recommended_funds(category: str) -> List[Dict]:
        """Recommend concrete funds or simulated tickers."""
        # Standard assets mapped to our TICKERS
        if category == "CONSERVATIVE":
            return [
                {"symbol": "GOLD", "name": "SBI Gold ETF", "weight": "10%", "type": "Gold", "description": "Hedge against inflation, stable value."},
                {"symbol": "HDFCBANK", "name": "HDFC Fixed Deposit / Debt Fund", "weight": "60%", "type": "Debt", "description": "Highly secure capital preservation."},
                {"symbol": "NIFTY50", "name": "Nifty 50 Index Fund", "weight": "20%", "type": "Equities", "description": "Broad market index tracking large caps."},
                {"symbol": "CASH", "name": "Liquid Cash/Bank Savings", "weight": "10%", "type": "Cash", "description": "Instantly accessible emergency cash."}
            ]
        elif category == "MODERATE":
            return [
                {"symbol": "NIFTY50", "name": "Nifty 50 Index Fund", "weight": "35%", "type": "Equities", "description": "Large-cap bluechip index tracker."},
                {"symbol": "RELIANCE", "name": "Reliance Bluechip Growth", "weight": "15%", "type": "Equities", "description": "India's largest company, solid growth driver."},
                {"symbol": "HDFCBANK", "name": "HDFC Debt Bond Fund", "weight": "35%", "type": "Debt", "description": "Stable returns with lower volatility than stocks."},
                {"symbol": "GOLD", "name": "SBI Gold ETF", "weight": "10%", "type": "Gold", "description": "Precious metals portfolio hedge."},
                {"symbol": "CASH", "name": "Liquid Savings Account", "weight": "5%", "type": "Cash", "description": "Emergency liquidity."}
            ]
        else: # AGGRESSIVE
            return [
                {"symbol": "NIFTY50", "name": "Nifty 50 Index Fund", "weight": "40%", "type": "Equities", "description": "Core index equity representation."},
                {"symbol": "RELIANCE", "name": "Reliance Growth Stock", "weight": "20%", "type": "Equities", "description": "High growth index heavy-weight."},
                {"symbol": "TCS", "name": "TCS Technology Fund", "weight": "10%", "type": "Equities", "description": "Exposure to IT sector exports."},
                {"symbol": "INFY", "name": "Infosys Growth Equity", "weight": "10%", "type": "Equities", "description": "IT exporter giant, high beta growth."},
                {"symbol": "HDFCBANK", "name": "HDFC Liquid Bond Fund", "weight": "10%", "type": "Debt", "description": "Minimal debt allocation for minor stability."},
                {"symbol": "GOLD", "name": "SBI Gold ETF", "weight": "5%", "type": "Gold", "description": "Minor commodity allocation."},
                {"symbol": "CASH", "name": "Liquid Cash", "weight": "5%", "type": "Cash", "description": "Emergency cash."}
            ]

    @staticmethod
    def get_personalized_recommendations(user_id: str, db: Session) -> List[Dict]:
        """Analyze past month transactions to generate personalized savings tips."""
        recommendations = []
        
        # Get user accounts
        accounts = db.query(Account).filter(Account.user_id == user_id).all()
        account_ids = [a.id for a in accounts]
        if not account_ids:
            return [{"title": "Link Bank Accounts", "message": "Link your bank accounts to enable AI recommendations.", "savings_potential": 0}]
            
        now = datetime.datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0)
        
        # Sum by category for the current month
        cat_spending = db.query(
            Transaction.category,
            func.sum(Transaction.amount).label("total")
        ).filter(
            Transaction.account_id.in_(account_ids),
            Transaction.transaction_type == "DEBIT",
            Transaction.timestamp >= month_start
        ).group_by(Transaction.category).all()
        
        total_debits = sum(c.total for c in cat_spending) or 0
        
        # Check Food & Dining excess
        food_spend = next((c.total for c in cat_spending if c.category == "Food & Dining"), 0)
        if food_spend > 5000:
            savings = round(food_spend * 0.15, 2)
            recommendations.append({
                "title": "Reduce Dining Spending",
                "message": f"You spent ₹{food_spend:,.2f} on Food & Dining this month. Cutting dining out by 15% saves ₹{savings:,.2f}, which can buy {round(savings/MarketDataService.get_live_price('GOLD'), 2)} units of Gold ETF.",
                "savings_potential": savings,
                "action_type": "BUDGET_REDUCTION",
                "category": "Food & Dining"
            })
            
        # Check Shopping excess
        shopping_spend = next((c.total for c in cat_spending if c.category == "Shopping"), 0)
        if shopping_spend > 7000:
            savings = round(shopping_spend * 0.20, 2)
            recommendations.append({
                "title": "Smart Shopping Tip",
                "message": f"Your shopping expenses are ₹{shopping_spend:,.2f}. Saving 20% on impulsive shopping saves ₹{savings:,.2f}. Investing this in Nifty 50 Fund could yield ~12% annualized.",
                "savings_potential": savings,
                "action_type": "BUDGET_REDUCTION",
                "category": "Shopping"
            })
            
        # Check if they have an active RoboProfile
        profile = db.query(RoboProfile).filter(RoboProfile.user_id == user_id).first()
        if not profile:
            recommendations.append({
                "title": "Configure Robo-Advisor",
                "message": "Take the AI Robo Questionnaire to unlock personalized asset allocations and investment roadmaps.",
                "savings_potential": 0,
                "action_type": "ROBO_QUESTIONNAIRE",
                "category": "General"
            })
        else:
            # Recommend based on allocation profile
            weight_str = "80%" if profile.risk_tolerance == "AGGRESSIVE" else ("50%" if profile.risk_tolerance == "MODERATE" else "20%")
            recommendations.append({
                "title": "Allocate according to Risk Profile",
                "message": f"Based on your {profile.risk_tolerance} profile, you should route {weight_str} of your monthly savings target (₹{profile.monthly_investment_target:,.2f}) into Equities (like RELIANCE or TCS).",
                "savings_potential": profile.monthly_investment_target,
                "action_type": "PORTFOLIO_ALLOCATION",
                "category": "Investments"
            })
            
        # Fallback if no specific spend recommendations
        if len(recommendations) < 2:
            recommendations.append({
                "title": "Create a SIP (Systematic Investment Plan)",
                "message": "Setting up a monthly SIP of ₹2,000 on the 5th of every month helps build financial discipline. We recommend the Nifty 50 Index Fund.",
                "savings_potential": 2000,
                "action_type": "SIP_PROPOSAL",
                "category": "Investments"
            })
            
        return recommendations

    @staticmethod
    def get_financial_plan(user_id: str, db: Session) -> Dict:
        """Generate a complete interactive financial plan response."""
        profile = db.query(RoboProfile).filter(RoboProfile.user_id == user_id).first()
        if not profile:
            return {"configured": False, "message": "No Robo-Advisor profile found. Please complete the assessment."}
            
        # Get user income
        from app.models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        income = user.monthly_income if user else 0.0
        
        # Calculate standard 50/30/20 budget allocations
        needs = income * 0.50
        wants = income * 0.30
        savings = income * 0.20
        
        allocation = RoboAdvisorService.get_allocation_mix(profile.risk_tolerance)
        funds = RoboAdvisorService.get_recommended_funds(profile.risk_tolerance)
        tips = RoboAdvisorService.get_personalized_recommendations(user_id, db)
        
        # Calculate projected growth
        # Aggressive: ~12% return, Moderate: ~9% return, Conservative: ~6% return
        rate = 0.12 if profile.risk_tolerance == "AGGRESSIVE" else (0.09 if profile.risk_tolerance == "MODERATE" else 0.06)
        monthly = profile.monthly_investment_target or savings
        
        # Future value of ordinary annuity: FV = P * [((1 + r)^n - 1) / r]
        # where r is monthly rate, n is number of months
        projected = []
        r_monthly = rate / 12
        for years in [1, 3, 5, 10]:
            n = years * 12
            fv = monthly * (((1 + r_monthly)**n - 1) / r_monthly) * (1 + r_monthly)
            projected.append({
                "years": years,
                "projected_value": round(fv, 2),
                "total_invested": round(monthly * n, 2),
                "earnings": round(fv - (monthly * n), 2)
            })
            
        return {
            "configured": True,
            "profile": {
                "age": profile.age,
                "risk_tolerance": profile.risk_tolerance,
                "risk_score": profile.risk_score,
                "investment_horizon": profile.investment_horizon,
                "monthly_investment_target": profile.monthly_investment_target,
                "financial_goal": profile.financial_goal
            },
            "rule_50_30_20": {
                "needs": round(needs, 2),
                "wants": round(wants, 2),
                "savings": round(savings, 2)
            },
            "allocation": allocation,
            "recommended_assets": funds,
            "personalized_tips": tips,
            "projected_growth": projected,
            "rate_of_return_pct": int(rate * 100)
        }

