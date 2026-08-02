import json
import re
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from app.models.finance import Transaction, Account, Budget, SavingsGoal, Alert, Holding, InvestmentTransaction, RoboProfile
from app.models.user import User
from app.core.config import settings
from app.ai.categorizer import categorize_transaction
from app.ai.anomaly_detector import check_anomaly
from app.services.budget_service import update_budget_on_transaction
from app.services.alert_service import create_alert
from app.api.transactions import broadcast_transaction
from app.services.robo_advisor_service import RoboAdvisorService
from app.services.portfolio_service import PortfolioService

# Unified schemas for tools
TOOLS = [
    {
        "name": "get_transactions",
        "description": "Get a list of user transactions with optional filters for category and limit.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Filter transactions by category (e.g. Food, Transport, Rent, Entertainment)"},
                "limit": {"type": "integer", "description": "Max number of transactions to return (default 10)", "default": 10}
            }
        }
    },
    {
        "name": "create_transaction",
        "description": "Create a new manual transaction (debit or credit).",
        "parameters": {
            "type": "object",
            "properties": {
                "amount": {"type": "number", "description": "The transaction amount in Rupees"},
                "merchant": {"type": "string", "description": "The name of the merchant or source"},
                "description": {"type": "string", "description": "Optional description/details for the transaction"},
                "transaction_type": {"type": "string", "enum": ["DEBIT", "CREDIT"], "description": "Whether this is a DEBIT (expense) or CREDIT (income)"},
                "category": {"type": "string", "description": "Optional category. If omitted, AI will auto-categorize it."}
            },
            "required": ["amount", "merchant", "transaction_type"]
        }
    },
    {
        "name": "get_budgets",
        "description": "List all monthly budgets and see how much has been spent.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "create_budget",
        "description": "Create a new budget or update an existing budget's limit for a category.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "The category for the budget (e.g., Food, Rent, Transport, Entertainment)"},
                "limit_amount": {"type": "number", "description": "The maximum spending limit in Rupees"}
            },
            "required": ["category", "limit_amount"]
        }
    },
    {
        "name": "get_savings_goals",
        "description": "List all user savings goals and check current progress.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "create_savings_goal",
        "description": "Create a new savings goal with a target amount and optional monthly contribution.",
        "parameters": {
            "type": "object",
            "properties": {
                "goal_name": {"type": "string", "description": "Name of the savings goal (e.g., New Laptop, Vacation)"},
                "target_amount": {"type": "number", "description": "The target amount to save in Rupees"},
                "monthly_contribution": {"type": "number", "description": "Optional monthly contribution set aside for this goal"},
                "deadline_days": {"type": "integer", "description": "Optional number of days from now to achieve the goal"}
            },
            "required": ["goal_name", "target_amount"]
        }
    },
    {
        "name": "add_savings_contribution",
        "description": "Contribute money towards a specific savings goal.",
        "parameters": {
            "type": "object",
            "properties": {
                "goal_id": {"type": "string", "description": "The UUID of the savings goal (or its name)"},
                "amount": {"type": "number", "description": "The contribution amount in Rupees"}
            },
            "required": ["goal_id", "amount"]
        }
    },
    {
        "name": "get_investment_portfolio",
        "description": "Retrieve simulated stock and asset holdings portfolio summary.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "trade_asset",
        "description": "Execute a simulated BUY or SELL order for an asset ticker symbol.",
        "parameters": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "The asset ticker symbol (e.g. RELIANCE, TCS, INFY, BTC)"},
                "transaction_type": {"type": "string", "enum": ["BUY", "SELL"], "description": "BUY or SELL order"},
                "quantity": {"type": "number", "description": "Number of shares/units to trade"}
            },
            "required": ["symbol", "transaction_type", "quantity"]
        }
    },
    {
        "name": "get_robo_advisor_plan",
        "description": "Get the Robo-advisor recommended asset allocations based on risk tolerance profile.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
]

# Tool Executors
def run_tool_get_transactions(db: Session, user_id: str, limit: int = 10, category: str = None) -> dict:
    account_ids = [a.id for a in db.query(Account).filter(Account.user_id == user_id).all()]
    if not account_ids:
        return {"status": "success", "data": [], "message": "No linked accounts found."}
    query = db.query(Transaction).filter(Transaction.account_id.in_(account_ids))
    if category:
        query = query.filter(Transaction.category.ilike(f"%{category}%"))
    txns = query.order_by(Transaction.timestamp.desc()).limit(limit).all()
    
    res = []
    for t in txns:
        res.append({
            "id": str(t.id),
            "amount": t.amount if t.transaction_type == "CREDIT" else -abs(t.amount),
            "merchant": t.merchant,
            "category": t.category,
            "type": t.transaction_type,
            "timestamp": t.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "description": t.description
        })
    return {"status": "success", "data": res, "message": f"Retrieved {len(res)} transactions."}


async def run_tool_create_transaction(db: Session, user_id: str, amount: float, merchant: str, transaction_type: str, description: str = None, category: str = None) -> dict:
    account = db.query(Account).filter(Account.user_id == user_id).first()
    if not account:
        account = Account(
            user_id=user_id,
            bank_name="Simulated Bank",
            account_token="simulated:checking",
            account_last4="9999",
            account_type="savings",
            balance=100000.0
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        
    transaction_type = transaction_type.upper()
    if transaction_type not in ["DEBIT", "CREDIT"]:
        transaction_type = "DEBIT"
        
    if not category:
        category, subcategory = categorize_transaction(merchant, amount, description or "")
    else:
        subcategory = "General"
        
    is_anomaly, anomaly_score = check_anomaly(user_id, amount, merchant, db)
    
    import random
    from app.services.simulation_service import CHENNAI_CATEGORY_COORDS
    base_coord = CHENNAI_CATEGORY_COORDS.get(category) or CHENNAI_CATEGORY_COORDS.get("Other")
    lat = base_coord["lat"] + random.uniform(-0.015, 0.015)
    lng = base_coord["lng"] + random.uniform(-0.015, 0.015)
    
    txn = Transaction(
        account_id=account.id,
        amount=amount,
        merchant=merchant,
        description=description or f"Added by Agent",
        transaction_type=transaction_type,
        timestamp=datetime.utcnow(),
        category=category,
        subcategory=subcategory,
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
        latitude=lat,
        longitude=lng
    )
    db.add(txn)
    
    if transaction_type == "DEBIT":
        update_budget_on_transaction(user_id, category, amount, db)
        account.balance -= amount
    else:
        account.balance += amount
        
    if is_anomaly:
        create_alert(
            db, user_id, "ANOMALY",
            f"Unusual transaction at {merchant}",
            f"A transaction of ₹{amount:.2f} at {merchant} looks suspicious.",
            "HIGH"
        )
        
    db.commit()
    db.refresh(txn)
    
    try:
        await broadcast_transaction({
            'id': str(txn.id),
            'amount': txn.amount if txn.transaction_type == 'CREDIT' else -abs(txn.amount),
            'merchant': txn.merchant,
            'category': txn.category,
            'transaction_type': txn.transaction_type,
            'timestamp': str(txn.timestamp),
            'latitude': txn.latitude,
            'longitude': txn.longitude,
        }, user_id)
    except Exception:
        pass
        
    return {
        "status": "success",
        "data": {
            "id": str(txn.id),
            "amount": amount,
            "merchant": merchant,
            "category": category,
            "type": transaction_type
        },
        "message": f"Successfully created {transaction_type} transaction of ₹{amount:.2f} at {merchant}."
    }


def run_tool_get_budgets(db: Session, user_id: str) -> dict:
    now = datetime.now()
    budgets = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.month == now.month,
        Budget.year == now.year
    ).all()
    res = []
    for b in budgets:
        res.append({
            "id": str(b.id),
            "category": b.category,
            "limit_amount": b.limit_amount,
            "spent_amount": b.spent_amount,
            "remaining": b.limit_amount - b.spent_amount
        })
    return {"status": "success", "data": res, "message": f"Retrieved {len(res)} budgets."}


def run_tool_create_budget(db: Session, user_id: str, category: str, limit_amount: float) -> dict:
    now = datetime.now()
    existing = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.category == category,
        Budget.month == now.month,
        Budget.year == now.year
    ).first()
    
    if existing:
        existing.limit_amount = limit_amount
        db.commit()
        db.refresh(existing)
        budget = existing
    else:
        budget = Budget(
            user_id=user_id,
            category=category,
            limit_amount=limit_amount,
            spent_amount=0.0,
            period="monthly",
            month=now.month,
            year=now.year
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)
        
    return {
        "status": "success",
        "data": {
            "id": str(budget.id),
            "category": budget.category,
            "limit_amount": budget.limit_amount,
            "spent_amount": budget.spent_amount
        },
        "message": f"Successfully set budget for {category} to ₹{limit_amount:.2f}."
    }


def run_tool_get_savings_goals(db: Session, user_id: str) -> dict:
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).all()
    res = []
    for g in goals:
        res.append({
            "id": str(g.id),
            "goal_name": g.goal_name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "monthly_contribution": g.monthly_contribution,
            "deadline": g.deadline.strftime("%Y-%m-%d") if g.deadline else None,
            "is_completed": g.is_completed,
            "progress_percent": round((g.current_amount / g.target_amount * 100) if g.target_amount else 0, 1)
        })
    return {"status": "success", "data": res, "message": f"Retrieved {len(res)} savings goals."}


def run_tool_create_savings_goal(db: Session, user_id: str, goal_name: str, target_amount: float, monthly_contribution: float = 0.0, deadline_days: int = None) -> dict:
    deadline = None
    if deadline_days is not None:
        deadline = datetime.utcnow() + timedelta(days=deadline_days)
        
    goal = SavingsGoal(
        user_id=user_id,
        goal_name=goal_name,
        target_amount=target_amount,
        monthly_contribution=monthly_contribution,
        deadline=deadline,
        current_amount=0.0,
        is_completed=False
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    return {
        "status": "success",
        "data": {
            "id": str(goal.id),
            "goal_name": goal.goal_name,
            "target_amount": goal.target_amount,
            "current_amount": goal.current_amount
        },
        "message": f"Successfully created savings goal '{goal_name}' with a target of ₹{target_amount:.2f}."
    }


def run_tool_add_savings_contribution(db: Session, user_id: str, goal_id: str, amount: float) -> dict:
    # Try finding by ID first, then by name
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == user_id
    ).first()
    
    if not goal:
        # Fallback search by goal name
        goal = db.query(SavingsGoal).filter(
            SavingsGoal.goal_name.ilike(goal_id),
            SavingsGoal.user_id == user_id
        ).first()
        
    if not goal:
        return {"status": "error", "message": f"Savings goal not found: '{goal_id}'."}
        
    goal.current_amount += amount
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True
        try:
            from app.api.gamification import UserBadge
            existing_badge = db.query(UserBadge).filter(
                UserBadge.user_id == user_id,
                UserBadge.badge_key == "goal_achiever"
            ).first()
            if not existing_badge:
                db.add(UserBadge(user_id=user_id, badge_key="goal_achiever"))
        except Exception:
            pass
            
    db.commit()
    db.refresh(goal)
    
    return {
        "status": "success",
        "data": {
            "id": str(goal.id),
            "goal_name": goal.goal_name,
            "current_amount": goal.current_amount,
            "target_amount": goal.target_amount,
            "is_completed": goal.is_completed
        },
        "message": f"Added ₹{amount:.2f} contribution to '{goal.goal_name}'."
    }


def run_tool_get_investment_portfolio(db: Session, user_id: str) -> dict:
    portfolio = PortfolioService.get_portfolio_summary(user_id, db)
    return {"status": "success", "data": portfolio, "message": "Retrieved simulated investment portfolio."}


def run_tool_trade_asset(db: Session, user_id: str, symbol: str, transaction_type: str, quantity: float) -> dict:
    action = transaction_type.upper()
    symbol = symbol.upper()
    
    from app.services.market_data_service import MarketDataService
    price = MarketDataService.get_live_price(symbol)
    if price == 0.0 or price is None:
        price = 100.0  # Fallback
        
    cost = price * quantity
    
    sim_account = db.query(Account).filter(
        Account.user_id == user_id,
        Account.account_token.like("simulated:%")
    ).first()
    
    if action == "BUY":
        if sim_account and sim_account.balance < cost:
            return {
                "status": "error",
                "message": f"Insufficient funds in simulated bank account ({sim_account.bank_name}) to purchase {quantity} shares of {symbol}. Cost: ₹{cost:,.2f}, Balance: ₹{sim_account.balance:,.2f}"
            }
            
        holding = PortfolioService.buy_asset(user_id, symbol, quantity, db)
        if sim_account:
            sim_account.balance -= cost
            db.commit()
            
        return {
            "status": "success",
            "data": {
                "symbol": symbol,
                "quantity": quantity,
                "price": price,
                "total_cost": cost,
                "holding_qty": holding.quantity
            },
            "message": f"Successfully purchased {quantity} shares of {symbol} at ₹{price:.2f}/share."
        }
    elif action == "SELL":
        try:
            res = PortfolioService.sell_asset(user_id, symbol, quantity, db)
            if sim_account:
                sim_account.balance += cost
                db.commit()
                
            return {
                "status": "success",
                "data": {
                    "symbol": symbol,
                    "quantity": quantity,
                    "price": price,
                    "total_revenue": cost,
                    "holding_qty": res["remaining_quantity"]
                },
                "message": f"Successfully sold {quantity} shares of {symbol} at ₹{price:.2f}/share."
            }
        except ValueError as e:
            return {"status": "error", "message": str(e)}
            
    return {"status": "error", "message": "Invalid trade action."}


def run_tool_get_robo_advisor_plan(db: Session, user_id: str) -> dict:
    plan = RoboAdvisorService.get_financial_plan(user_id, db)
    return {"status": "success", "data": plan, "message": "Retrieved Robo-advisor asset allocation plan."}


async def execute_tool(name: str, args: dict, user_id: str, db: Session) -> dict:
    try:
        if name == "get_transactions":
            return run_tool_get_transactions(db, user_id, **args)
        elif name == "create_transaction":
            return await run_tool_create_transaction(db, user_id, **args)
        elif name == "get_budgets":
            return run_tool_get_budgets(db, user_id)
        elif name == "create_budget":
            return run_tool_create_budget(db, user_id, **args)
        elif name == "get_savings_goals":
            return run_tool_get_savings_goals(db, user_id)
        elif name == "create_savings_goal":
            return run_tool_create_savings_goal(db, user_id, **args)
        elif name == "add_savings_contribution":
            return run_tool_add_savings_contribution(db, user_id, **args)
        elif name == "get_investment_portfolio":
            return run_tool_get_investment_portfolio(db, user_id)
        elif name == "trade_asset":
            return run_tool_trade_asset(db, user_id, **args)
        elif name == "get_robo_advisor_plan":
            return run_tool_get_robo_advisor_plan(db, user_id)
        else:
            return {"status": "error", "message": f"Unknown tool: {name}"}
    except Exception as e:
        import traceback
        print(f"Error executing tool {name}: {e}")
        traceback.print_exc()
        return {"status": "error", "message": f"Failed to execute tool {name}: {str(e)}"}


def is_valid_api_key(key: Optional[str]) -> bool:
    if not key:
        return False
    if "your" in key.lower():
        return False
    return True


async def run_fallback_agent(query: str, user_id: str, db: Session) -> Tuple[str, str, List[dict]]:
    query_lower = query.lower().strip()
    thoughts = "Analyzing user query for financial action intents (fallback offline mode)..."
    actions = []
    
    # 1. Budget creation: set budget for category to limit
    budget_match = re.search(r'(?:set|create|make|update)\s+(?:a\s+)?budget\s+(?:of\s+)?₹?\s*(\d+(?:\.\d+)?)\s*(?:for\s+)?([a-zA-Z\s&]+)', query_lower)
    category_raw = None
    limit_val = 0.0
    if budget_match:
        limit_val = float(budget_match.group(1))
        category_raw = budget_match.group(2)
    else:
        budget_match_alt = re.search(r'([a-zA-Z\s&]+)\s+budget\s+(?:to|of\s+)?₹?\s*(\d+(?:\.\d+)?)', query_lower)
        if budget_match_alt:
            category_raw = budget_match_alt.group(1)
            limit_val = float(budget_match_alt.group(2))
            
    if category_raw:
        category = category_raw.strip().title()
        if "Food" in category: category = "Food & Dining"
        elif "Rent" in category: category = "Rent"
        elif "Travel" in category or "Transport" in category: category = "Transport"
        elif "Entertain" in category: category = "Entertainment"
        elif "Health" in category: category = "Health"
        elif "Util" in category: category = "Utilities"
        elif "Saving" in category: category = "Savings"
        
        thoughts += f"\nDetected budget creation intent for category '{category}' with limit ₹{limit_val:.2f}."
        res = run_tool_create_budget(db, user_id, category, limit_val)
        actions.append({
            "tool": "create_budget",
            "arguments": {"category": category, "limit_amount": limit_val},
            "result": res
        })
        response = f"✅ I have successfully set your monthly budget for **{category}** to ₹{limit_val:,.2f}."
        return response, thoughts, actions
        
    # 2. Add transaction: spent 500 at Starbucks
    tx_match = re.search(r'(?:spent|debit|add|record)\s+(?:a\s+)?(?:transaction\s+of\s+)?₹?\s*(\d+(?:\.\d+)?)\s*(?:at|for|to)?\s*([a-zA-Z\s0-9]+)(?:\s+for\s+([a-zA-Z\s]+))?', query_lower)
    if tx_match:
        amount = float(tx_match.group(1))
        merchant = tx_match.group(2).strip().title()
        description = tx_match.group(3)
        description = description.strip() if description else f"Spent at {merchant}"
        
        thoughts += f"\nDetected manual transaction creation intent: ₹{amount:.2f} at {merchant}."
        res = await run_tool_create_transaction(db, user_id, amount, merchant, "DEBIT", description)
        actions.append({
            "tool": "create_transaction",
            "arguments": {"amount": amount, "merchant": merchant, "transaction_type": "DEBIT", "description": description},
            "result": res
        })
        response = f"💸 Recorded an expense of ₹{amount:,.2f} at **{merchant}** under category **{res['data']['category']}**."
        return response, thoughts, actions
        
    # 3. Add credit transaction (income)
    credit_match = re.search(r'(?:received|credit|add income of)\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:from|at)?\s*([a-zA-Z\s0-9]+)', query_lower)
    if credit_match:
        amount = float(credit_match.group(1))
        merchant = credit_match.group(2).strip().title()
        thoughts += f"\nDetected income transaction creation intent: ₹{amount:.2f} from {merchant}."
        res = await run_tool_create_transaction(db, user_id, amount, merchant, "CREDIT", f"Received from {merchant}")
        actions.append({
            "tool": "create_transaction",
            "arguments": {"amount": amount, "merchant": merchant, "transaction_type": "CREDIT"},
            "result": res
        })
        response = f"💰 Recorded income of ₹{amount:,.2f} from **{merchant}**."
        return response, thoughts, actions

    # 4. View budgets: "show budgets"
    if any(k in query_lower for k in ["show budgets", "my budgets", "list budgets", "view budgets"]):
        thoughts += "\nDetected budget query intent. Retrieving monthly budget status."
        res = run_tool_get_budgets(db, user_id)
        actions.append({
            "tool": "get_budgets",
            "arguments": {},
            "result": res
        })
        if res["data"]:
            lines = ["Here is your current budget status:"]
            for b in res["data"]:
                lines.append(f"- **{b['category']}**: Spent ₹{b['spent_amount']:.2f} / Limit ₹{b['limit_amount']:.2f} (Remaining: ₹{b['remaining']:.2f})")
            response = "\n".join(lines)
        else:
            response = "You have no budgets set for this month. You can set one by typing: `set a budget of ₹5000 for Food`"
        return response, thoughts, actions

    # 5. View transactions: "show transactions"
    if any(k in query_lower for k in ["show transactions", "recent transactions", "list transactions", "view transactions"]):
        thoughts += "\nDetected transaction query intent. Fetching 10 most recent transactions."
        res = run_tool_get_transactions(db, user_id, limit=10)
        actions.append({
            "tool": "get_transactions",
            "arguments": {"limit": 10},
            "result": res
        })
        if res["data"]:
            lines = ["Here are your 10 most recent transactions:"]
            for t in res["data"]:
                symbol = "💸" if t["type"] == "DEBIT" else "💰"
                lines.append(f"{symbol} **{t['merchant']}**: ₹{abs(t['amount']):.2f} [{t['category']}] ({t['timestamp'][:10]})")
            response = "\n".join(lines)
        else:
            response = "No transactions found in your account."
        return response, thoughts, actions

    # 6. Savings Goals creation
    goal_create_match = re.search(r'(?:create|add|new)\s+goal\s+([a-zA-Z\s0-9]+)\s+(?:target|amount|of)\s+₹?\s*(\d+(?:\.\d+)?)', query_lower)
    if goal_create_match:
        goal_name = goal_create_match.group(1).strip().title()
        target = float(goal_create_match.group(2))
        thoughts += f"\nDetected savings goal creation: '{goal_name}' target ₹{target:.2f}."
        res = run_tool_create_savings_goal(db, user_id, goal_name, target)
        actions.append({
            "tool": "create_savings_goal",
            "arguments": {"goal_name": goal_name, "target_amount": target},
            "result": res
        })
        response = f"🎯 Created a new savings goal: **{goal_name}** with a target of ₹{target:,.2f}."
        return response, thoughts, actions

    # 6b. List savings goals
    if any(k in query_lower for k in ["show goals", "my goals", "list goals", "savings goals"]):
        thoughts += "\nDetected savings goals query intent."
        res = run_tool_get_savings_goals(db, user_id)
        actions.append({
            "tool": "get_savings_goals",
            "arguments": {},
            "result": res
        })
        if res["data"]:
            lines = ["Here are your current savings goals:"]
            for g in res["data"]:
                status = "✅ Completed!" if g["is_completed"] else f"{g['progress_percent']}%"
                lines.append(f"- **{g['goal_name']}**: ₹{g['current_amount']:.2f} / ₹{g['target_amount']:.2f} ({status})")
            response = "\n".join(lines)
        else:
            response = "You have no savings goals configured. Create one by typing: `create goal iPhone target 80000`"
        return response, thoughts, actions

    # 6c. Contribute to goal
    contrib_match = re.search(r'(?:contribute|add)\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:to\s+)?(?:goal\s+)?([a-zA-Z\s0-9]+)', query_lower)
    if contrib_match:
        amount = float(contrib_match.group(1))
        goal_name = contrib_match.group(2).strip()
        thoughts += f"\nDetected savings goal contribution intent: ₹{amount:.2f} to goal matching '{goal_name}'."
        
        goal = db.query(SavingsGoal).filter(
            SavingsGoal.goal_name.ilike(f"%{goal_name}%"),
            SavingsGoal.user_id == user_id
        ).first()
        
        if goal:
            res = run_tool_add_savings_contribution(db, user_id, str(goal.id), amount)
            actions.append({
                "tool": "add_savings_contribution",
                "arguments": {"goal_id": str(goal.id), "amount": amount},
                "result": res
            })
            response = f"📥 Contributed ₹{amount:,.2f} to savings goal **{goal.goal_name}**. New progress: ₹{goal.current_amount:,.2f} / ₹{goal.target_amount:,.2f}."
        else:
            response = f"Could not find a savings goal matching '{goal_name}'."
        return response, thoughts, actions

    # 7. Portfolio summary
    if any(k in query_lower for k in ["show investments", "my investments", "holdings", "portfolio", "assets"]):
        thoughts += "\nDetected investment portfolio query intent."
        res = run_tool_get_investment_portfolio(db, user_id)
        actions.append({
            "tool": "get_investment_portfolio",
            "arguments": {},
            "result": res
        })
        port = res["data"]
        if port.get("total_value", 0) > 0:
            lines = [
                f"📊 **Simulated Investment Portfolio Summary**:",
                f"- Total Value: ₹{port['total_value']:,.2f}",
                f"- Total P&L: ₹{port['total_pnl']:,.2f}",
                "\nHoldings:"
            ]
            for h in port.get("holdings", []):
                lines.append(f"  • **{h['symbol']}** ({h['name']}): {h['quantity']} shares @ avg price ₹{h['avg_buy_price']:.2f} (Current: ₹{h['current_price']:.2f}, P&L: ₹{h['pnl']:.2f})")
            response = "\n".join(lines)
        else:
            response = "Your simulated investment portfolio is currently empty. You can purchase assets by typing: `buy 10 shares of RELIANCE`."
        return response, thoughts, actions

    # 8. Buy/sell simulated stock
    trade_match = re.search(r'(buy|sell)\s+(\d+(?:\.\d+)?)\s+(?:shares\s+of\s+)?([a-zA-Z0-9]+)', query_lower)
    if trade_match:
        action = trade_match.group(1).upper()
        qty = float(trade_match.group(2))
        symbol = trade_match.group(3).upper()
        thoughts += f"\nDetected simulated trade intent: {action} {qty} shares of {symbol}."
        res = run_tool_trade_asset(db, user_id, symbol, action, qty)
        actions.append({
            "tool": "trade_asset",
            "arguments": {"symbol": symbol, "transaction_type": action, "quantity": qty},
            "result": res
        })
        if res["status"] == "success":
            response = f"📈 Executed order: **{action}** {qty} shares of **{symbol}**. {res['message']}"
        else:
            response = f"⚠️ Trade failed: {res['message']}"
        return response, thoughts, actions

    # Default chatbot response using context
    thoughts += "\nNo action intent matched. Providing structured context-aware financial advice."
    from app.ai.chatbot import get_financial_context
    context = get_financial_context(user_id, db)
    
    response = "I am ready! Configure an LLM API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) in `.env` to activate full multi-turn conversational intelligence. In offline mode, you can control me directly using commands like:\n" \
               "• `set a budget of 5000 for Food`\n" \
               "• `spent 350 at Starbucks`\n" \
               "• `create goal Trip target 30000`\n" \
               "• `buy 10 shares of RELIANCE`\n" \
               "• `show budgets` / `show investments`"
    return response, thoughts, actions


async def run_openai_agent(query: str, user_id: str, db: Session, chat_history: List[dict] = None, system_prompt: Optional[str] = None) -> Tuple[str, str, List[dict]]:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    openai_tools = []
    for t in TOOLS:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"]
            }
        })
        
    from app.ai.chatbot import get_financial_context
    context = get_financial_context(user_id, db)
    
    if not system_prompt:
        system_prompt = f"""You are an autonomous AI Financial Agent with direct access to user financial actions.
You can retrieve transactions, create budgets, add transactions, manage savings goals, check portfolio status, and execute stock trades on behalf of the user.

USER'S CURRENT FINANCIAL DATA CONTEXT:
{context}

Always call tools to retrieve data or perform actions rather than guessing. 
If the user wants to add an expense, set a budget, contribute to a goal, or trade assets, call the appropriate tool. 
Be concise and helpful in your final responses. Include a step-by-step summary of what you did.
Always use ₹ for Rupee amounts.
"""
    else:
        if "{context}" in system_prompt:
            system_prompt = system_prompt.format(context=context)
        else:
            system_prompt = f"{system_prompt}\n\nUSER'S CURRENT FINANCIAL DATA CONTEXT:\n{context}"
            
    messages = [{"role": "system", "content": system_prompt}]
    if chat_history:
        for h in chat_history[-6:]:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": query})
    
    thoughts = "Calling OpenAI to parse intent and determine agent actions..."
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=openai_tools,
        tool_choice="auto",
        max_tokens=800
    )
    
    response_message = response.choices[0].message
    tool_calls = response_message.tool_calls
    actions = []
    
    if tool_calls:
        thoughts += f"\nAgent decided to call {len(tool_calls)} tools:"
        messages.append(response_message)
        
        for tool_call in tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            thoughts += f"\n  - Calling Tool '{name}' with arguments {args}..."
            
            result = await execute_tool(name, args, user_id, db)
            thoughts += f"\n    Result: {result['status']} - {result['message']}"
            
            actions.append({
                "tool": name,
                "arguments": args,
                "result": result
            })
            
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": name,
                "content": json.dumps(result)
            })
            
        final_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=600
        )
        return final_response.choices[0].message.content, thoughts, actions
    else:
        return response_message.content, thoughts, actions


async def run_anthropic_agent(query: str, user_id: str, db: Session, chat_history: List[dict] = None, system_prompt: Optional[str] = None) -> Tuple[str, str, List[dict]]:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    anthropic_tools = []
    for t in TOOLS:
        anthropic_tools.append({
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"]
        })
        
    from app.ai.chatbot import get_financial_context
    context = get_financial_context(user_id, db)
    
    if not system_prompt:
        system_prompt = f"""You are an autonomous AI Financial Agent with direct access to user financial actions.
You can retrieve transactions, create budgets, add transactions, manage savings goals, check portfolio status, and execute stock trades on behalf of the user.

USER'S CURRENT FINANCIAL DATA CONTEXT:
{context}

Always call tools to retrieve data or perform actions rather than guessing. 
If the user wants to add an expense, set a budget, contribute to a goal, or trade assets, call the appropriate tool. 
Be concise and helpful in your final responses. Include a step-by-step summary of what you did.
Always use ₹ for Rupee amounts.
"""
    else:
        if "{context}" in system_prompt:
            system_prompt = system_prompt.format(context=context)
        else:
            system_prompt = f"{system_prompt}\n\nUSER'S CURRENT FINANCIAL DATA CONTEXT:\n{context}"
    messages = []
    if chat_history:
        for h in chat_history[-6:]:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": query})
    
    thoughts = "Calling Anthropic to parse intent and determine agent actions..."
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=800,
        system=system_prompt,
        messages=messages,
        tools=anthropic_tools
    )
    
    actions = []
    tool_calls = [content for content in response.content if content.type == "tool_use"]
    text_content = [content.text for content in response.content if content.type == "text"]
    response_text = text_content[0] if text_content else ""
    
    if tool_calls:
        thoughts += f"\nAgent decided to call {len(tool_calls)} tools:"
        assistant_content = []
        for tc in tool_calls:
            assistant_content.append({
                "type": "tool_use",
                "id": tc.id,
                "name": tc.name,
                "input": tc.input
            })
        if response_text:
            assistant_content.insert(0, {"type": "text", "text": response_text})
            
        messages.append({"role": "assistant", "content": assistant_content})
        
        tool_results_content = []
        for tc in tool_calls:
            name = tc.name
            args = tc.input
            thoughts += f"\n  - Calling Tool '{name}' with arguments {args}..."
            
            result = await execute_tool(name, args, user_id, db)
            thoughts += f"\n    Result: {result['status']} - {result['message']}"
            
            actions.append({
                "tool": name,
                "arguments": args,
                "result": result
            })
            
            tool_results_content.append({
                "type": "tool_result",
                "tool_use_id": tc.id,
                "content": json.dumps(result)
            })
            
        messages.append({"role": "user", "content": tool_results_content})
        
        final_response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=600,
            system=system_prompt,
            messages=messages,
            tools=anthropic_tools
        )
        final_text_content = [c.text for c in final_response.content if c.type == "text"]
        return final_text_content[0] if final_text_content else "Completed tool execution.", thoughts, actions
    else:
        return response_text, thoughts, actions


async def run_agent(query: str, user_id: str, db: Session, chat_history: List[dict] = None, system_prompt: Optional[str] = None) -> Tuple[str, str, List[dict]]:
    """Runs the AI financial agent, selecting between OpenAI, Anthropic, or regex fallback."""
    if is_valid_api_key(settings.ANTHROPIC_API_KEY):
        try:
            return await run_anthropic_agent(query, user_id, db, chat_history, system_prompt)
        except Exception as e:
            print(f"Anthropic agent failed: {e}")
            
    if is_valid_api_key(settings.OPENAI_API_KEY):
        try:
            return await run_openai_agent(query, user_id, db, chat_history, system_prompt)
        except Exception as e:
            print(f"OpenAI agent failed: {e}")
            
    return await run_fallback_agent(query, user_id, db)
