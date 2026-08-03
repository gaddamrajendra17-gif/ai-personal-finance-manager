from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
import datetime
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Transaction, Account, Budget, SavingsGoal

router = APIRouter(prefix="/api/financial-advisor", tags=["AI Advisor"])

def get_user_transaction_stats(user_id: str, db: Session) -> Dict:
    """Helper to compute advanced spending behaviors from user's history."""
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    account_ids = [a.id for a in accounts]
    
    if not account_ids:
        return {
            "total_debits": 0, "debit_count": 0, "average_ticket": 0,
            "weekend_ratio": 0.5, "peak_hours": "N/A", "behavior_type": "BALANCED",
            "shopping_dining_ratio": 0, "velocity_daily": 0
        }
        
    now = datetime.datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    
    # Query transactions of the current month
    txns = db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.timestamp >= month_start
    ).all()
    
    debits = [t for t in txns if t.transaction_type == "DEBIT"]
    credits = [t for t in txns if t.transaction_type == "CREDIT"]
    
    total_debits = sum(d.amount for d in debits)
    debit_count = len(debits)
    average_ticket = total_debits / debit_count if debit_count > 0 else 0.0
    
    # Calculate spending velocity (Rs. spent per day in current month)
    days_elapsed = max(1, now.day)
    velocity_daily = round(total_debits / days_elapsed, 2)
    
    # Weekend vs Weekday ratio
    weekday_spend = 0.0
    weekend_spend = 0.0
    for d in debits:
        if d.timestamp.weekday() >= 5: # Saturday/Sunday
            weekend_spend += d.amount
        else:
            weekday_spend += d.amount
    total_spend = weekend_spend + weekday_spend
    weekend_ratio = round(weekend_spend / total_spend, 2) if total_spend > 0 else 0.5
    
    # Peak spending hour range
    hours = [d.timestamp.hour for d in debits]
    if hours:
        # Categorize hours
        morning = len([h for h in hours if 6 <= h < 12])
        afternoon = len([h for h in hours if 12 <= h < 17])
        evening = len([h for h in hours if 17 <= h < 22])
        night = len([h for h in hours if h >= 22 or h < 6])
        
        peak_counts = {"Morning (6 AM - 12 PM)": morning, "Afternoon (12 PM - 5 PM)": afternoon, "Evening (5 PM - 10 PM)": evening, "Night (10 PM - 6 AM)": night}
        peak_hours = max(peak_counts, key=peak_counts.get)
    else:
        peak_hours = "Afternoon (12 PM - 5 PM)"
        
    # Categories analysis
    shopping_spend = sum(d.amount for d in debits if d.category == "Shopping")
    dining_spend = sum(d.amount for d in debits if d.category == "Food & Dining")
    shopping_dining_ratio = round((shopping_spend + dining_spend) / total_spend, 2) if total_spend > 0 else 0.0
    
    # Behavioral Profiler
    user = db.query(User).filter(User.id == user_id).first()
    income = user.monthly_income if user else 50000.0
    savings_rate = (income - total_debits) / income if income > 0 else 0.0
    
    if savings_rate > 0.40:
        behavior_type = "FRUGAL_SAVER"
    elif shopping_dining_ratio > 0.45:
        behavior_type = "IMPULSIVE"
    elif total_debits > income * 0.90:
        behavior_type = "LIFESTYLE_INFLATED"
    else:
        behavior_type = "BALANCED"
        
    return {
        "total_debits": round(total_debits, 2),
        "debit_count": debit_count,
        "average_ticket": round(average_ticket, 2),
        "weekend_ratio": weekend_ratio,
        "peak_hours": peak_hours,
        "behavior_type": behavior_type,
        "shopping_dining_ratio": shopping_dining_ratio,
        "velocity_daily": velocity_daily
    }

@router.get("/behavior")
def get_behavior_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve user behavioral classification and pattern analysis metrics."""
    stats = get_user_transaction_stats(str(current_user.id), db)
    
    # Compute 5-year compounding wealth impact (benefit)
    # Estimate extra savings potential based on behavioral profile
    extra_savings = 5000.0 if stats["behavior_type"] == "IMPULSIVE" else (2000.0 if stats["behavior_type"] == "FRUGAL_SAVER" else 3500.0)
    rate = 0.12 # 12% equity growth assumption
    n = 60 # 5 years (60 months)
    r = rate / 12
    fv = extra_savings * (((1 + r)**n - 1) / r) * (1 + r)
    
    return {
        "classification": stats["behavior_type"],
        "metrics": {
            "daily_velocity": stats["velocity_daily"],
            "average_transaction": stats["average_ticket"],
            "weekend_percentage": int(stats["weekend_ratio"] * 100),
            "peak_spending_time": stats["peak_hours"],
            "leisure_shopping_ratio": int(stats["shopping_dining_ratio"] * 100)
        },
        "benefits_projection": {
            "monthly_optimizable": extra_savings,
            "compounded_five_years": round(fv, 2),
            "estimated_yield": "12% p.a."
        }
    }

@router.get("/advice")
def get_advisory(
    persona: str = "balanced",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve customized advisories and warnings based on selected advisor persona."""
    stats = get_user_transaction_stats(str(current_user.id), db)
    
    # Calculate health score based on velocity and behavior
    health_score = 85
    if stats["behavior_type"] == "IMPULSIVE":
        health_score -= 20
    elif stats["behavior_type"] == "LIFESTYLE_INFLATED":
        health_score -= 25
    elif stats["behavior_type"] == "FRUGAL_SAVER":
        health_score += 10
    health_score = max(10, min(100, health_score))
    
    advice_list = []
    monitoring_alerts = []
    
    # Generate monitoring alerts
    if stats["velocity_daily"] > (current_user.monthly_income / 30 * 0.9):
        monitoring_alerts.append({
            "severity": "HIGH",
            "message": f"Daily spending velocity (₹{stats['velocity_daily']:.0f}/day) is approaching 90% of your daily income rate."
        })
    if stats["weekend_ratio"] > 0.6:
        monitoring_alerts.append({
            "severity": "MEDIUM",
            "message": "Concentrated weekend spending detected. Pattern suggests discretionary impulse purchasing."
        })
    if stats["shopping_dining_ratio"] > 0.4:
        monitoring_alerts.append({
            "severity": "MEDIUM",
            "message": "High concentration of outlays on Shopping & dining. Room for budget reallocation."
        })
    if not monitoring_alerts:
        monitoring_alerts.append({
            "severity": "LOW",
            "message": "All monitored spending vectors are within optimal risk levels."
        })

    # Persona specific text recommendations
    persona = persona.lower()
    if persona == "frugal":
        advice_list = [
            f"Set up a strict dining limit of ₹3,000 this month. You have spent ₹{stats['total_debits'] * stats['shopping_dining_ratio'] * 0.4:.0f} on dining out.",
            "Postpone all clothing and electronic purchases for 30 days to build emergency cash reserves.",
            "Transfer ₹4,000 immediately to a fixed deposit or gold fund to freeze liquid assets."
        ]
        title = "Frugal Coach Advice"
        coach_desc = "Highly disciplined advisor focused on capital preservation and cost-cutting."
    elif persona == "goal_focused":
        # Check savings goals
        goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
        goal_name = goals[0].goal_name if goals else "your primary savings goal"
        
        advice_list = [
            f"Redirect ₹3,000 from Shopping directly to '{goal_name}' to reach your target weeks early.",
            "Set up an automated SIP of ₹2,500 on the 1st of every month to guarantee goal funding.",
            "Review your subscription list: cutting just one unused ₹500/month entertainment subscription shaves 2 months off your savings roadmap."
        ]
        title = "Goal Coach Advice"
        coach_desc = "Actionable roadmap planner focused on achieving your saved milestones."
    else: # Balanced Mentor
        advice_list = [
            "Maintain the 50/30/20 budget framework: ensure at least 20% of income is routed to investments.",
            "Your average transaction is ₹{:.0f}. Keep large-ticket discretionary items below ₹5,000 to avoid lifestyle drift.".format(stats["average_ticket"]),
            "Set up a weekly spending alert: scanning transaction patterns every Sunday ensures early budget corrections."
        ]
        title = "Balanced Mentor Advice"
        coach_desc = "Pragmatic guide balancing short-term enjoyment with long-term compound growth."
        
    return {
        "advisor_name": title,
        "description": coach_desc,
        "health_score": health_score,
        "recommendations": advice_list,
        "monitoring_alerts": monitoring_alerts
    }

