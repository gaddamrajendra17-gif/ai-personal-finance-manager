"""
AI Financial Chatbot using RAG (Retrieval-Augmented Generation).
Connects to user's transaction data and answers financial questions.
"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.finance import Transaction, Account, Budget
from app.core.config import settings


def retrieve_relevant_transactions(query: str, user_id: str, db: Session) -> List[Transaction]:
    """Retrieve top-5 relevant transactions matching the query, falling back to 5 most recent."""
    account_ids = [
        a.id for a in db.query(Account).filter(Account.user_id == user_id).all()
    ]
    if not account_ids:
        return []

    base_query = db.query(Transaction).filter(Transaction.account_id.in_(account_ids))

    # Try matching keywords in query (stripping punctuation first)
    import re
    cleaned_query = re.sub(r'[^\w\s]', '', query)
    keywords = [w.lower() for w in cleaned_query.split() if len(w) > 2]
    if keywords:
        from sqlalchemy import or_
        filters = []
        for kw in keywords:
            filters.append(Transaction.description.ilike(f"%{kw}%"))
            filters.append(Transaction.merchant.ilike(f"%{kw}%"))
            filters.append(Transaction.category.ilike(f"%{kw}%"))
        results = base_query.filter(or_(*filters)).order_by(Transaction.timestamp.desc()).limit(5).all()
        if results:
            return results

    # Fallback to top-5 most recent
    return base_query.order_by(Transaction.timestamp.desc()).limit(5).all()


def get_financial_context(user_id: str, db: Session) -> str:
    """Build financial context string from user's data."""
    account_ids = [
        a.id for a in db.query(Account).filter(Account.user_id == user_id).all()
    ]

    from datetime import datetime, timedelta
    from sqlalchemy import func
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)

    # This month transactions
    txns = db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.timestamp >= month_start
    ).order_by(Transaction.timestamp.desc()).limit(100).all()

    # Category totals
    cat_totals = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        Transaction.timestamp >= month_start
    ).group_by(Transaction.category).all()

    # Budgets
    budgets = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.month == now.month,
        Budget.year == now.year
    ).all()

    # Build context
    context_parts = [
        f"Current month: {now.strftime('%B %Y')}",
        "\nMonthly spending by category:",
    ]
    for cat in cat_totals:
        context_parts.append(f"  - {cat.category or 'Other'}: ₹{cat.total:.2f}")

    if budgets:
        context_parts.append("\nBudget status:")
        for b in budgets:
            pct = (b.spent_amount / b.limit_amount * 100) if b.limit_amount else 0
            context_parts.append(
                f"  - {b.category}: ₹{b.spent_amount:.2f} / ₹{b.limit_amount:.2f} ({pct:.0f}%)"
            )

    context_parts.append(f"\nRecent transactions (last 20):")
    for t in txns[:20]:
        context_parts.append(
            f"  - {t.timestamp.strftime('%d %b')}: {t.merchant} ₹{t.amount:.2f} [{t.category}]"
        )

    return "\n".join(context_parts)


async def chat_with_ai(
    user_id: str,
    message: str,
    db: Session,
    chat_history: Optional[List[dict]] = None
) -> Tuple[str, str, List[dict]]:
    """
    Answer financial questions using the AI agent.
    Delegates to agent.py for tool use and fallback rule parsing.
    """
    from app.ai.agent import run_agent
    msg_lower = message.lower()
    
    # ── Intent 1: Fraud / Anomaly Detection Check ────────────────────
    if any(x in msg_lower for x in ["anomaly", "suspicious", "fraud", "strange", "unauthorized"]):
        from app.models.finance import Transaction, Account
        account_ids = [a.id for a in db.query(Account).filter(Account.user_id == user_id).all()]
        if not account_ids:
            return "No linked accounts found. Please link a bank account to scan for transaction anomalies.", "Fraud check intent matched.", []
            
        anomalies = db.query(Transaction).filter(
            Transaction.account_id.in_(account_ids),
            Transaction.is_anomaly == True
        ).order_by(Transaction.timestamp.desc()).limit(5).all()
        
        if anomalies:
            items = []
            for a in anomalies:
                items.append(f"₹{a.amount:,.2f} at {a.merchant} on {a.timestamp.strftime('%d %b %Y')} (Score: {a.anomaly_score or 0.0:.2f})")
            return "⚠️ SUSPICIOUS ACTIVITY SCAN COMPLETE:\nWe detected the following transaction anomalies:\n" + "\n".join([f"  • {x}" for x in items]) + "\n\nIf you did not make these transactions, please contact your bank immediately to lock your card.", "Fraud check complete. Anomalies found.", []
        else:
            return "✅ SUSPICIOUS ACTIVITY SCAN COMPLETE:\nNo anomalous or fraudulent transactions were detected in your accounts. Everything looks secure!", "Fraud check complete. No anomalies found.", []

    # ── Intent 2: Robo-Advisor / Investment Advice ───────────────────
    if any(x in msg_lower for x in ["recommend", "advice", "invest", "allocation", "portfolio", "asset", "robo", "trading"]):
        from app.services.robo_advisor_service import RoboAdvisorService
        from app.services.portfolio_service import PortfolioService
        
        plan = RoboAdvisorService.get_financial_plan(user_id, db)
        portfolio = PortfolioService.get_portfolio_summary(user_id, db)
        
        resp = []
        if plan.get("configured"):
            profile = plan["profile"]
            resp.append(f"🤖 **Robo-Advisor Profile**: {profile['risk_tolerance']} (Risk Score: {profile['risk_score']}/100)")
            resp.append(f"📈 **Monthly Investment Target**: ₹{profile['monthly_investment_target']:,.2f}")
            
            alloc_desc = ", ".join([f"{k}: {v}%" for k, v in plan["allocation"].items()])
            resp.append(f"💼 **Recommended Allocation**: {alloc_desc}")
            
            if portfolio["total_value"] > 0:
                resp.append(f"📊 **Current Simulated Portfolio**: ₹{portfolio['total_value']:,.2f} (P&L: ₹{portfolio['total_pnl']:,.2f})")
                if portfolio.get("risk_warning"):
                    resp.append(f"🚨 **Alert**: {portfolio['risk_warning_message']}")
            else:
                resp.append("💡 *Tip: Go to the 'AI Investments' tab to start building your simulated portfolio according to this allocation.*")
                
            return "\n".join(resp), "Robo advisor advice generated.", []
        else:
            return "🤖 **Robo-Advisor Portfolio Manager**:\nYou haven't completed your risk assessment yet. Please navigate to the **Robo-Advisor** tab in the sidebar to fill out the questionnaire. Once configured, I will give you detailed allocation and asset suggestions!", "Robo advisor advice pending risk configuration.", []

    # Delegate all other requests to the Agent
    return await run_agent(message, user_id, db, chat_history)


def _rule_based_response(message: str, context: str) -> str:
    """Simple keyword-based fallback when no LLM is configured."""
    msg = message.lower()
    if "food" in msg or "dining" in msg:
        for line in context.split("\n"):
            if "Food" in line:
                return f"Based on your transactions: {line.strip()}. Configure an LLM API key for smarter insights!"
    if "budget" in msg:
        return "Check your budget status in the dashboard. Add your OPENAI_API_KEY or ANTHROPIC_API_KEY to .env for AI-powered answers!"
    if "save" in msg or "saving" in msg:
        return "To save more, identify your top spending category and reduce it by 10-15%. Use the budget simulator for goal planning!"
    return "I'm a rule-based fallback. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to your .env file to enable AI-powered financial chat!"

