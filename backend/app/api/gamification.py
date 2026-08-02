from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models.user import User
from datetime import datetime

router = APIRouter(prefix="/api/gamification", tags=["gamification"])

class Badge(Base):
    __tablename__ = "badges"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    icon = Column(String, default="🏅")
    points = Column(Integer, default=100)

class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    badge_key = Column(String, nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)

class Challenge(Base):
    __tablename__ = "challenges"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String)
    target_value = Column(Float, default=0)
    points = Column(Integer, default=50)
    challenge_type = Column(String, default="savings")
    is_active = Column(Boolean, default=True)

class UserChallenge(Base):
    __tablename__ = "user_challenges"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    challenge_id = Column(Integer, ForeignKey("challenges.id"))
    progress = Column(Float, default=0)
    completed = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

BADGES = [
    {"key": "first_transaction", "name": "First Step", "description": "Log your first transaction", "icon": "🎯", "points": 50},
    {"key": "tracker_10", "name": "Consistent Tracker", "description": "Log 10 transactions", "icon": "📊", "points": 100},
    {"key": "tracker_30", "name": "Tracking Pro", "description": "Log 30 transactions", "icon": "📈", "points": 200},
    {"key": "saver_1k", "name": "First Savings", "description": "Save ₹1,000", "icon": "💰", "points": 150},
    {"key": "saver_10k", "name": "Big Saver", "description": "Save ₹10,000", "icon": "💎", "points": 300},
    {"key": "saver_50k", "name": "Wealth Builder", "description": "Save ₹50,000", "icon": "🏆", "points": 500},
    {"key": "budget_setter", "name": "Budget Planner", "description": "Set your first budget", "icon": "📋", "points": 100},
    {"key": "goal_setter", "name": "Goal Getter", "description": "Set a financial goal", "icon": "🎯", "points": 100},
    {"key": "investor", "name": "Investor", "description": "Log an investment transaction", "icon": "📉", "points": 200},
    {"key": "debt_reducer", "name": "Debt Slayer", "description": "Make a loan/EMI payment", "icon": "⚔️", "points": 150},
    {"key": "no_splurge_week", "name": "Mindful Spender", "description": "No impulse purchases for a week", "icon": "🧘", "points": 200},
    {"key": "early_bird", "name": "Early Bird", "description": "Log a transaction before 8 AM", "icon": "🌅", "points": 75},
    {"key": "goal_achiever", "name": "Goal Achiever", "description": "Badge awarded for completing a savings goal", "icon": "🏆", "points": 250},
]

CHALLENGES = [
    {"title": "Save 5000 This Month", "description": "Track your savings and reach 5000", "target_value": 5000, "points": 300, "challenge_type": "savings"},
    {"title": "No Food Delivery Week", "description": "Avoid food delivery apps for 7 days", "target_value": 7, "points": 200, "challenge_type": "no_spend"},
    {"title": "Track 20 Transactions", "description": "Log 20 transactions this month", "target_value": 20, "points": 150, "challenge_type": "tracking"},
    {"title": "Stay Under Budget", "description": "Keep all categories within budget for a month", "target_value": 1, "points": 400, "challenge_type": "budget"},
]

def seed_gamification(db: Session):
    for b in BADGES:
        if not db.query(Badge).filter(Badge.key == b["key"]).first():
            db.add(Badge(**b))
    for c in CHALLENGES:
        if not db.query(Challenge).filter(Challenge.title == c["title"]).first():
            db.add(Challenge(**c))
    db.commit()

def calculate_level(points: int):
    levels = [(0,"Beginner","🌱"),(500,"Saver","💡"),(1000,"Tracker","📊"),(2000,"Planner","📋"),(4000,"Investor","📈"),(7000,"Wealth Builder","🏆")]
    current = levels[0]
    next_level = None
    for i, (threshold, name, icon) in enumerate(levels):
        if points >= threshold:
            current = (threshold, name, icon)
            next_level = levels[i + 1] if i + 1 < len(levels) else None
    return {"name": current[1], "icon": current[2], "next_level": next_level[1] if next_level else "Max Level", "points_to_next": (next_level[0] - points) if next_level else 0}

def check_and_award_badges(db: Session, user_id):
    from app.models.finance import Account, Transaction, Budget, SavingsGoal
    from datetime import datetime
    
    # Get all earned badges keys
    earned = db.query(UserBadge).filter(UserBadge.user_id == user_id).all()
    earned_keys = {ub.badge_key for ub in earned}
    
    # 1. Transaction counts
    tx_count = db.query(Transaction).join(Account).filter(Account.user_id == user_id).count()
    
    # 2. Total active balance
    accounts = db.query(Account).filter(Account.user_id == user_id, Account.is_active == True).all()
    total_balance = sum(a.balance for a in accounts)
    
    # 3. Budgets configured
    budget_count = db.query(Budget).filter(Budget.user_id == str(user_id)).count()
    
    # 4. Savings goals
    goal_count = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).count()
    
    # 5. Investments category check
    has_investment = db.query(Transaction).join(Account).filter(
        Account.user_id == user_id,
        Transaction.category.ilike("Investments") | Transaction.category.ilike("Investment")
    ).first() is not None
    
    # 6. Debt category or description check
    has_debt = db.query(Transaction).join(Account).filter(
        Account.user_id == user_id,
        Transaction.category.ilike("Debt/EMI") | Transaction.category.ilike("Debt") |
        Transaction.description.ilike("%EMI%") | Transaction.description.ilike("%Loan%") | Transaction.description.ilike("%Mortgage%") |
        Transaction.merchant.ilike("%EMI%") | Transaction.merchant.ilike("%Loan%") | Transaction.merchant.ilike("%Mortgage%")
    ).first() is not None
    
    # 7. Early bird check (before 8 AM local/UTC)
    txs = db.query(Transaction).join(Account).filter(Account.user_id == user_id).all()
    has_early_bird = any(t.timestamp.hour < 8 for t in txs)
    
    badges_to_award = []
    
    if tx_count >= 1 and "first_transaction" not in earned_keys:
        badges_to_award.append("first_transaction")
    if tx_count >= 10 and "tracker_10" not in earned_keys:
        badges_to_award.append("tracker_10")
    if tx_count >= 30 and "tracker_30" not in earned_keys:
        badges_to_award.append("tracker_30")
        
    if total_balance >= 1000 and "saver_1k" not in earned_keys:
        badges_to_award.append("saver_1k")
    if total_balance >= 10000 and "saver_10k" not in earned_keys:
        badges_to_award.append("saver_10k")
    if total_balance >= 50000 and "saver_50k" not in earned_keys:
        badges_to_award.append("saver_50k")
        
    if budget_count >= 1 and "budget_setter" not in earned_keys:
        badges_to_award.append("budget_setter")
        
    if goal_count >= 1 and "goal_setter" not in earned_keys:
        badges_to_award.append("goal_setter")
        
    if has_investment and "investor" not in earned_keys:
        badges_to_award.append("investor")
        
    if has_debt and "debt_reducer" not in earned_keys:
        badges_to_award.append("debt_reducer")
        
    if has_early_bird and "early_bird" not in earned_keys:
        badges_to_award.append("early_bird")
        
    if badges_to_award:
        for key in badges_to_award:
            db.add(UserBadge(user_id=user_id, badge_key=key, earned_at=datetime.utcnow()))
        db.commit()


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    seed_gamification(db)
    check_and_award_badges(db, current_user.id)
    earned = db.query(UserBadge).filter(UserBadge.user_id == current_user.id).all()
    earned_keys = {ub.badge_key for ub in earned}
    total_points = 0
    badges_out = []
    all_badges = db.query(Badge).all()
    for b in all_badges:
        is_earned = b.key in earned_keys
        if is_earned:
            total_points += b.points
        badges_out.append({"key": b.key, "name": b.name, "description": b.description, "icon": b.icon, "points": b.points, "earned": is_earned})
    level_info = calculate_level(total_points)
    return {"user_id": str(current_user.id), "name": current_user.full_name, "total_points": total_points, "level": level_info, "badges": badges_out, "badges_earned": len(earned_keys), "badges_total": len(all_badges)}


@router.get("/challenges")
def get_challenges(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    seed_gamification(db)
    challenges = db.query(Challenge).filter(Challenge.is_active == True).all()
    result = []
    
    from sqlalchemy import func
    from datetime import datetime, timedelta
    from app.models.finance import Transaction, Account, Budget
    
    now = datetime.utcnow()
    start_of_month = datetime(now.year, now.month, 1)
    
    for c in challenges:
        uc = db.query(UserChallenge).filter(UserChallenge.user_id == current_user.id, UserChallenge.challenge_id == c.id).first()
        if uc:
            progress = uc.progress or 0.0
            has_tx = db.query(Transaction).join(Account).filter(Account.user_id == current_user.id).first() is not None
            if has_tx or progress == 0.0:
                if c.title == "Save 5000 This Month":
                    credits_sum = db.query(func.sum(Transaction.amount)).join(Account).filter(
                        Account.user_id == current_user.id,
                        Transaction.transaction_type == "CREDIT",
                        Transaction.timestamp >= start_of_month
                    ).scalar() or 0.0
                    debits_sum = db.query(func.sum(Transaction.amount)).join(Account).filter(
                        Account.user_id == current_user.id,
                        Transaction.transaction_type == "DEBIT",
                        Transaction.timestamp >= start_of_month
                    ).scalar() or 0.0
                    income = credits_sum if credits_sum > 0 else (current_user.monthly_income or 0.0)
                    progress = max(0.0, income - debits_sum)
                    
                elif c.title == "No Food Delivery Week":
                    seven_days_ago = now - timedelta(days=7)
                    food_tx = db.query(Transaction).join(Account).filter(
                        Account.user_id == current_user.id,
                        Transaction.timestamp >= seven_days_ago,
                        Transaction.merchant.ilike("%Swiggy%") | Transaction.merchant.ilike("%Zomato%")
                    ).first()
                    progress = 7.0 if not food_tx else 0.0
                    
                elif c.title == "Track 20 Transactions":
                    tx_count = db.query(Transaction).join(Account).filter(
                        Account.user_id == current_user.id,
                        Transaction.timestamp >= start_of_month
                    ).count()
                    progress = float(tx_count)
                    
                elif c.title == "Stay Under Budget":
                    budgets = db.query(Budget).filter(Budget.user_id == str(current_user.id)).all()
                    if not budgets:
                        progress = 0.0
                    else:
                        exceeded = False
                        for b in budgets:
                            spent = db.query(func.sum(Transaction.amount)).join(Account).filter(
                                Account.user_id == current_user.id,
                                Transaction.category.ilike(b.category),
                                Transaction.transaction_type == "DEBIT",
                                Transaction.timestamp >= start_of_month
                            ).scalar() or 0.0
                            if spent > b.amount:
                                exceeded = True
                                break
                        progress = 1.0 if not exceeded else 0.0
            
            uc.progress = progress
            if progress >= c.target_value:
                uc.completed = True
                uc.completed_at = now
            else:
                uc.completed = False
            db.commit()
            
        result.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "target_value": c.target_value,
            "points": c.points,
            "challenge_type": c.challenge_type,
            "joined": uc is not None,
            "progress": uc.progress if uc else 0,
            "completed": uc.completed if uc else False
        })
    return result

@router.post("/challenges/{challenge_id}/join")
def join_challenge(challenge_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    existing = db.query(UserChallenge).filter(UserChallenge.user_id == current_user.id, UserChallenge.challenge_id == challenge_id).first()
    if existing:
        return {"message": "Already joined"}
    db.add(UserChallenge(user_id=current_user.id, challenge_id=challenge_id))
    db.commit()
    return {"message": "Joined challenge!", "challenge": challenge.title}

@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = db.query(User).filter(User.is_active == True).all()
    leaderboard = []
    for u in users:
        earned = db.query(UserBadge).filter(UserBadge.user_id == u.id).all()
        points = sum((db.query(Badge).filter(Badge.key == ub.badge_key).first() or Badge(points=0)).points for ub in earned)
        leaderboard.append({"name": u.full_name, "points": points, "badges": len(earned)})
    leaderboard.sort(key=lambda x: x["points"], reverse=True)
    return leaderboard[:10]
