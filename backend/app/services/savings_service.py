from sqlalchemy.orm import Session
from app.models.finance import SavingsStrategy, SavingsGoal, Account, Transaction
from app.services.notification_service import create_notification
from app.ai.anomaly_detector import check_anomaly
from app.ai.categorizer import categorize_transaction
from app.services.budget_service import update_budget_on_transaction
import datetime
import uuid

class SavingsService:
    @staticmethod
    def run_automated_transfers(db: Session, user_id: str) -> dict:
        """
        Scan active automated savings strategies and execute transfers.
        Applies low cash-flow checks: pauses execution if balance falls below ₹10,000.
        """
        strategies = db.query(SavingsStrategy).filter(
            SavingsStrategy.user_id == user_id,
            SavingsStrategy.status == "ACTIVE"
        ).all()
        
        executed = []
        paused = []
        
        for s in strategies:
            account = s.source_account
            goal = s.destination_goal
            
            if not account or not goal:
                continue
                
            # Cash-flow safety check: pause if checking account balance drops below ₹10,000 threshold
            safety_limit = 10000.0
            if account.balance < (safety_limit + s.transfer_amount):
                # Low cash flow, pause execution and notify user
                create_notification(
                    db, user_id,
                    "⚠️ Savings Transfer Paused",
                    f"Auto-save transfer of ₹{s.transfer_amount:,.2f} to '{goal.goal_name}' paused to prevent low checking balance (current: ₹{account.balance:,.2f}).",
                    "warning"
                )
                paused.append({
                    "strategy_id": str(s.id),
                    "plan_name": s.plan_name,
                    "reason": f"Account balance ₹{account.balance:.2f} is below ₹10,000 threshold."
                })
                continue
                
            # Execute transfer
            account.balance -= s.transfer_amount
            goal.current_amount += s.transfer_amount
            
            # Check if goal is completed
            if goal.current_amount >= goal.target_amount:
                goal.is_completed = True
                create_notification(
                    db, user_id,
                    "🏆 Savings Goal Reached!",
                    f"Congratulations! You completed your savings goal '{goal.goal_name}' of ₹{goal.target_amount:,.2f}!",
                    "success"
                )
                
            # Record simulated DEBIT Transaction in checking account
            txn_id = uuid.uuid4()
            txn = Transaction(
                id=txn_id,
                account_id=account.id,
                amount=s.transfer_amount,
                merchant="PFM AI Auto-Save",
                description=f"Automated transfer to goal: {goal.goal_name}",
                category="Investments",
                subcategory="Savings Transfer",
                transaction_type="DEBIT",
                timestamp=datetime.datetime.utcnow(),
                is_anomaly=False,
                anomaly_score=0.0
            )
            db.add(txn)
            
            # Update budget
            update_budget_on_transaction(user_id, "Investments", s.transfer_amount, db)
            
            executed.append({
                "strategy_id": str(s.id),
                "plan_name": s.plan_name,
                "amount": s.transfer_amount,
                "goal_name": goal.goal_name
            })
            
        db.commit()
        return {
            "executed": executed,
            "paused": paused
        }

    @staticmethod
    def get_goal_recommendations(user_id: str, db: Session) -> list:
        """
        Suggest personalized monthly goal-based contributions matching current cash flow
        and deadline trajectories using predictive calculations.
        """
        import datetime
        from app.models.finance import SavingsGoal, Account, Transaction

        goals = db.query(SavingsGoal).filter(
            SavingsGoal.user_id == user_id,
            SavingsGoal.is_completed == False
        ).all()
        
        accounts = db.query(Account).filter(Account.user_id == user_id).all()
        total_balance = sum(a.balance for a in accounts)
        
        # 1. Analyze user cash flow from the last 30 days of transactions
        thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
        account_ids = [a.id for a in accounts]
        
        recent_txns = db.query(Transaction).filter(
            Transaction.account_id.in_(account_ids),
            Transaction.timestamp >= thirty_days_ago
        ).all()
        
        total_income = sum(t.amount for t in recent_txns if t.transaction_type == "CREDIT")
        total_spent = sum(abs(t.amount) for t in recent_txns if t.transaction_type == "DEBIT")
        net_savings_rate = total_income - total_spent
        
        recommendations = []
        
        # 2. Runway / Liquidity Checks
        if total_spent > 0:
            daily_burn_rate = total_spent / 30.0
            runway_days = total_balance / daily_burn_rate
            if runway_days < 15:
                recommendations.append({
                    "goal_id": None,
                    "goal_name": "Liquidity Alert",
                    "type": "LIQUIDITY_CRITICAL",
                    "message": f"🚨 Critical Liquidity Warning: Your current bank balance (₹{total_balance:,.2f}) covers less than 15 days of your typical spending. We strongly advise pausing automated savings transfers to ensure immediate cash flow."
                })
            elif runway_days < 30:
                recommendations.append({
                    "goal_id": None,
                    "goal_name": "Liquidity Alert",
                    "type": "LIQUIDITY_WARNING",
                    "message": f"⚠️ Low Cash Runway: Your reserves cover approximately {runway_days:.0f} days of expenses. Hold off on increasing any automated savings rates right now."
                })

        # 3. Goal-specific Deadline and Rate Forecasting
        for g in goals:
            remaining = g.target_amount - g.current_amount
            if remaining <= 0:
                continue
                
            if g.deadline:
                # Calculate time remaining in months
                days_left = (g.deadline - datetime.datetime.utcnow()).days
                if days_left > 0:
                    months_left = max(1.0, days_left / 30.4)
                    required_monthly = round(remaining / months_left, 2)
                    
                    if g.monthly_contribution < required_monthly:
                        # Off-track recommendation
                        deficit = required_monthly - g.monthly_contribution
                        recommendations.append({
                            "goal_id": str(g.id),
                            "goal_name": g.goal_name,
                            "type": "INCREASE_CONTRIBUTION",
                            "amount": float(required_monthly),
                            "message": f"📉 Goal '{g.goal_name}' is off-track for its deadline ({g.deadline.strftime('%b %Y')}). You save ₹{g.monthly_contribution:,.0f}/mo, but need ₹{required_monthly:,.0f}/mo. Increase by ₹{deficit:,.0f}/mo to finish on time."
                        })
                    else:
                        # On-track confirmation
                        months_early = max(0.0, months_left - (remaining / g.monthly_contribution if g.monthly_contribution > 0 else months_left))
                        recommendations.append({
                            "goal_id": str(g.id),
                            "goal_name": g.goal_name,
                            "type": "ON_TRACK",
                            "message": f"🎉 On Track! Your monthly savings of ₹{g.monthly_contribution:,.0f} will secure your '{g.goal_name}' goal (₹{g.target_amount:,.0f}) approximately {months_early:.1f} months ahead of the {g.deadline.strftime('%b %Y')} deadline."
                        })
                else:
                    recommendations.append({
                        "goal_id": str(g.id),
                        "goal_name": g.goal_name,
                        "type": "DEADLINE_PASSED",
                        "message": f"⚠️ Passed Deadline: The target date for '{g.goal_name}' has passed. We recommend updating the target date or making a one-time sweep of ₹{remaining:,.2f} to complete it."
                    })
            else:
                # No deadline - project duration
                if g.monthly_contribution > 0:
                    months_needed = remaining / g.monthly_contribution
                    recommendations.append({
                        "goal_id": str(g.id),
                        "goal_name": g.goal_name,
                        "type": "PROJECTED_TIMELINE",
                        "message": f"📈 Savings timeline: At ₹{g.monthly_contribution:,.0f}/month, you will complete '{g.goal_name}' (remaining: ₹{remaining:,.2f}) in about {months_needed:.1f} months. Set a target date to enable AI tracking."
                    })
                else:
                    recommended_monthly = round(remaining * 0.05, -2) # target 20 months, round to nearest 100
                    recommended_monthly = max(500.0, recommended_monthly)
                    recommendations.append({
                        "goal_id": str(g.id),
                        "goal_name": g.goal_name,
                        "type": "START_CONTRIBUTION",
                        "amount": float(recommended_monthly),
                        "message": f"🎯 Inactive Goal: '{g.goal_name}' has no automated savings. Start a monthly contribution of ₹{recommended_monthly:,.0f} to reach the target in 20 months."
                    })

        # 4. Smart Cash-Flow Allocation recommendations
        priority_goal = goals[0] if goals else None
        if priority_goal and net_savings_rate > 5000:
            suggested_sweep = round(net_savings_rate * 0.30, -2) # 30% of surplus
            recommendations.append({
                "goal_id": str(priority_goal.id),
                "goal_name": priority_goal.goal_name,
                "type": "SURPLUS_SWEEP",
                "amount": float(suggested_sweep),
                "message": f"💡 AI Surplus Sweep: Your cash flow was positive by ₹{net_savings_rate:,.2f} last month. We recommend allocating a surplus sweep of ₹{suggested_sweep:,.0f} from your checking account to your priority goal '{priority_goal.goal_name}'."
            })
        elif net_savings_rate < -5000:
            recommendations.append({
                "goal_id": None,
                "goal_name": "Cash Flow Deficit",
                "type": "DEFICIT_WARNING",
                "message": f"🚨 Overspending Alert: You spent ₹{abs(net_savings_rate):,.2f} more than your monthly income over the last 30 days. Easing savings rates temporarily is recommended to protect your checkings balance."
            })

        if not recommendations:
            recommendations.append({
                "goal_id": None,
                "goal_name": "General Savings",
                "type": "SIP_STABLE",
                "message": "Cash flow is stable and checking account reserves look solid. Keep automated transfers running at current rates."
            })
            
        return recommendations
