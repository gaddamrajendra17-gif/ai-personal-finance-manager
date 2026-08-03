from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Budget, SavingsGoal, Account, Transaction
from app.schemas.schemas import BudgetCreate, BudgetOut, SavingsGoalCreate, SavingsGoalOut, ScenarioInput

router = APIRouter(prefix="/api/budgets", tags=["Budgets & Goals"])


# ── Budgets ───────────────────────────────────────────────────
@router.get("/", response_model=List[BudgetOut])
def get_budgets(
    month: int = datetime.now().month,
    year: int = datetime.now().year,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == month,
        Budget.year == year
    ).all()


@router.post("/", response_model=BudgetOut)
def create_budget(
    budget_data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.utcnow()
    # Check existing budget for this category+month
    existing = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.category == budget_data.category,
        Budget.month == now.month,
        Budget.year == now.year
    ).first()

    if existing:
        existing.limit_amount = budget_data.limit_amount
        db.commit()
        db.refresh(existing)
        return existing

    budget = Budget(
        user_id=current_user.id,
        category=budget_data.category,
        limit_amount=budget_data.limit_amount,
        period=budget_data.period,
        month=now.month,
        year=now.year,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.get("/recommend", response_model=List[dict])
def recommend_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """AI-powered budget recommendations using Gradient Boosted Decision Trees (GBDT)."""
    income = current_user.monthly_income or 0.0
    
    # 1. Fallback 50/30/20 values
    fallback_categories = {
        "Food & Dining": income * 0.15,
        "Rent": income * 0.25,
        "Transport": income * 0.10,
        "Entertainment": income * 0.05,
        "Health & Medical": income * 0.05,
        "Utilities": income * 0.05,
        "Shopping": income * 0.15,
        "Other": income * 0.20,
    }
    
    # 2. Get user's account IDs
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_ids = [a.id for a in accounts]
    
    if not account_ids:
        return [{"category": k, "recommended": round(v, 2), "method": "Rule-Based (50/30/20)"} for k, v in fallback_categories.items()]
        
    # 3. Fetch all debit transactions
    txns = db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT"
    ).all()
    
    if len(txns) < 10:
        # Too little transaction history, use fallback
        return [{"category": k, "recommended": round(v, 2), "method": "Rule-Based (50/30/20) - Cold Start"} for k, v in fallback_categories.items()]
        
    # 4. Process transaction history into monthly aggregates per category
    data = []
    for t in txns:
        cat = t.category or "Other"
        # Map to standard UI category names
        if cat == "Healthcare" or cat == "Health":
            cat = "Health & Medical"
        elif cat == "Others" or cat == "Other":
            cat = "Other"
            
        timestamp = t.timestamp or t.created_at
        month_key = f"{timestamp.year}-{timestamp.month:02d}"
        data.append({
            "category": cat,
            "amount": float(t.amount),
            "month": month_key
        })
        
    df = pd.DataFrame(data)
    # Aggregate spending per month per category
    agg = df.groupby(["category", "month"])["amount"].sum().reset_index()
    
    categories_list = list(fallback_categories.keys())
    recommendations = []
    
    for cat in categories_list:
        cat_df = agg[agg["category"] == cat].sort_values("month").reset_index(drop=True)
        if len(cat_df) < 3:
            val = fallback_categories.get(cat, income * 0.1)
            recommendations.append({"category": cat, "recommended": round(val, 2), "method": "Rule-Based (Fallback)"})
            continue
            
        # Create rolling lag features
        X_train = []
        y_train = []
        
        amounts = cat_df["amount"].values
        for i in range(2, len(amounts)):
            lag_1 = amounts[i-1]
            lag_2 = amounts[i-2]
            running_avg = np.mean(amounts[:i])
            running_max = np.max(amounts[:i])
            X_train.append([lag_1, lag_2, running_avg, running_max])
            y_train.append(amounts[i])
            
        if len(X_train) < 1:
            val = np.mean(amounts)
            recommendations.append({"category": cat, "recommended": round(val, 2), "method": "Average Historical Spend"})
            continue
            
        try:
            gbr = GradientBoostingRegressor(n_estimators=10, max_depth=3, random_state=42)
            gbr.fit(np.array(X_train), np.array(y_train))
            
            latest_lag_1 = amounts[-1]
            latest_lag_2 = amounts[-2]
            latest_avg = np.mean(amounts)
            latest_max = np.max(amounts)
            
            pred = gbr.predict([[latest_lag_1, latest_lag_2, latest_avg, latest_max]])[0]
            recommended = float(max(100.0, pred * 1.1))  # 10% safety buffer
            
            # Bound prediction to keep it realistic
            fallback_val = fallback_categories.get(cat, income * 0.1)
            if recommended > 2.0 * fallback_val:
                recommended = 2.0 * fallback_val
            elif recommended < 0.2 * fallback_val:
                recommended = 0.2 * fallback_val
                
            recommendations.append({
                "category": cat,
                "recommended": round(recommended, 2),
                "method": "Gradient Boosted Trees (GBDT)"
            })
        except Exception:
            val = np.mean(amounts)
            recommendations.append({"category": cat, "recommended": round(val, 2), "method": "Average Historical Spend (Fallback)"})
            
    return recommendations


@router.post("/simulate", response_model=dict)
def simulate_savings_scenario(payload: ScenarioInput):
    """Simulate: how many months to reach a savings goal?"""
    if payload.monthly_extra <= 0:
        raise HTTPException(400, "Monthly extra must be positive")

    months = (payload.goal - payload.current_savings) / payload.monthly_extra
    from datetime import timedelta
    target_date = datetime.utcnow() + timedelta(days=int(months * 30))

    return {
        "months_to_goal": round(months, 1),
        "target_date": target_date.strftime("%B %Y"),
        "total_to_save": payload.goal - payload.current_savings,
        "monthly_required": payload.monthly_extra
    }


# ── Savings Goals ─────────────────────────────────────────────
goals_router = APIRouter(prefix="/api/goals", tags=["Savings Goals"])


@goals_router.get("/", response_model=List[SavingsGoalOut])
def get_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
    for goal in goals:
        goal.progress_percent = round(
            (goal.current_amount / goal.target_amount * 100) if goal.target_amount else 0, 1
        )
    return goals


@goals_router.post("/", response_model=SavingsGoalOut)
def create_goal(
    goal_data: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goal = SavingsGoal(
        user_id=current_user.id,
        goal_name=goal_data.goal_name,
        target_amount=goal_data.target_amount,
        monthly_contribution=goal_data.monthly_contribution,
        deadline=goal_data.deadline,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    goal.progress_percent = 0.0
    return goal


@goals_router.put("/{goal_id}/contribute", response_model=SavingsGoalOut)
def add_contribution(
    goal_id: str,
    amount: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(404, "Goal not found")

    goal.current_amount += amount
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True
        # Award "Goal Achiever" badge if not already earned
        from app.api.gamification import UserBadge
        existing_badge = db.query(UserBadge).filter(
            UserBadge.user_id == current_user.id,
            UserBadge.badge_key == "goal_achiever"
        ).first()
        if not existing_badge:
            db.add(UserBadge(user_id=current_user.id, badge_key="goal_achiever"))

    db.commit()
    db.refresh(goal)
    goal.progress_percent = round(goal.current_amount / goal.target_amount * 100, 1)
    return goal


from pydantic import BaseModel

class BudgetUpdate(BaseModel):
    limit_amount: float

@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: str,
    budget_data: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id, Budget.user_id == current_user.id
    ).first()
    if not budget:
        raise HTTPException(404, "Budget not found")
    budget.limit_amount = budget_data.limit_amount
    db.commit()
    db.refresh(budget)
    return budget

@router.delete("/{budget_id}")
def delete_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id, Budget.user_id == current_user.id
    ).first()
    if not budget:
        raise HTTPException(404, "Budget not found")
    db.delete(budget)
    db.commit()
    return {"status": "deleted"}

class GoalUpdate(BaseModel):
    goal_name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    monthly_contribution: Optional[float] = None
    deadline: Optional[datetime] = None

@goals_router.put("/{goal_id}", response_model=SavingsGoalOut)
def update_goal(
    goal_id: str,
    goal_data: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    
    if goal_data.goal_name is not None:
        goal.goal_name = goal_data.goal_name
    if goal_data.target_amount is not None:
        goal.target_amount = goal_data.target_amount
    if goal_data.current_amount is not None:
        goal.current_amount = goal_data.current_amount
    if goal_data.monthly_contribution is not None:
        goal.monthly_contribution = goal_data.monthly_contribution
    if goal_data.deadline is not None:
        goal.deadline = goal_data.deadline
        
    db.commit()
    db.refresh(goal)
    goal.progress_percent = round(
        (goal.current_amount / goal.target_amount * 100) if goal.target_amount else 0, 1
    )
    return goal

@goals_router.delete("/{goal_id}")
def delete_goal(
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    db.delete(goal)
    db.commit()
    return {"status": "deleted"}


# ── Real-time Budget Adjustments & Goal Predictions ───────────────────
@router.get("/realtime-adjustments")
def get_realtime_adjustments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI-driven real-time budget adjustments.
    Analyzes category velocity and suggests shifting surplus limits to deficit areas.
    """
    now = datetime.now()
    budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == now.month,
        Budget.year == now.year
    ).all()
    
    surpluses = []
    deficits = []
    
    for b in budgets:
        remaining = b.limit_amount - b.spent_amount
        if remaining > 0.3 * b.limit_amount and remaining > 1000:
            surpluses.append({"category": b.category, "amount": remaining, "budget_id": str(b.id), "limit": b.limit_amount})
        elif b.spent_amount > b.limit_amount or (remaining < 0.1 * b.limit_amount and remaining > 0):
            deficit_amount = b.spent_amount - b.limit_amount if b.spent_amount > b.limit_amount else (0.1 * b.limit_amount - remaining)
            deficits.append({"category": b.category, "amount": max(500.0, deficit_amount), "budget_id": str(b.id), "limit": b.limit_amount})
            
    adjustments = []
    # Match surpluses with deficits
    for d in deficits:
        if not surpluses:
            break
        s = surpluses[0] # Pick the first available surplus
        shift_amount = round(min(s["amount"] * 0.5, d["amount"]), -2) # shift in units of 100
        if shift_amount >= 100:
            adjustments.append({
                "from_category": s["category"],
                "to_category": d["category"],
                "amount": shift_amount,
                "message": f"You have unused headroom in {s['category']} (₹{s['amount']:.2f} remaining). We suggest shifting ₹{shift_amount:,.0f} to {d['category']} to prevent budget overruns."
            })
            s["amount"] -= shift_amount
            if s["amount"] < 500:
                surpluses.pop(0)
                
    # If no specific adjustments matched but they are running low overall
    if not adjustments and budgets:
        # Fallback generic recommendation
        adjustments.append({
            "from_category": "Other",
            "to_category": "Investments",
            "amount": 1000.0,
            "message": "Your current overall budget looks stable. We recommend moving ₹1,000 to your simulated investments to accelerate compound returns."
        })
        
    return adjustments


@goals_router.get("/savings-prediction")
def predict_goals_feasibility(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI-driven savings goals trajectory forecasting.
    Predicts if the user will meet deadlines based on contribution rates.
    """
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_completed == False
    ).all()
    
    predictions = []
    for g in goals:
        remaining = g.target_amount - g.current_amount
        monthly = g.monthly_contribution or 1000.0
        
        months_needed = remaining / monthly
        days_needed = int(months_needed * 30.4)
        
        projected_date = datetime.utcnow() + timedelta(days=days_needed) if days_needed > 0 else datetime.utcnow()
        
        on_track = True
        if g.deadline:
            deadline_utc = g.deadline.replace(tzinfo=None)
            on_track = projected_date <= deadline_utc
            
        message = ""
        if on_track:
            message = f"On track! At ₹{monthly:,.2f}/month, you will hit your goal by {projected_date.strftime('%B %Y')}."
        else:
            required_monthly = remaining / ((g.deadline - datetime.utcnow()).days / 30.4) if g.deadline and (g.deadline - datetime.utcnow()).days > 0 else remaining
            message = f"Behind schedule. You will reach it by {projected_date.strftime('%B %Y')}. Increase contribution to ₹{required_monthly:,.2f}/month to meet your deadline."
            
        predictions.append({
            "goal_id": str(g.id),
            "goal_name": g.goal_name,
            "on_track": on_track,
            "projected_completion": projected_date.strftime("%Y-%m-%d"),
            "months_required": round(months_needed, 1),
            "message": message,
            "current_monthly": monthly,
            "recommended_monthly": round(required_monthly, 0) if not on_track else monthly
        })
        
    return predictions



