from datetime import datetime, timedelta
import random
import uuid
import asyncio
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.finance import Account, Transaction
from app.ai.categorizer import categorize_transaction
from app.ai.anomaly_detector import check_anomaly
from app.services.budget_service import update_budget_on_transaction
from app.services.notification_service import create_notification

# Defined categories and sample merchants
DEBIT_MERCHANTS = {
    "Food & Dining": ["Swiggy", "Zomato", "Starbucks", "McDonald's", "Domino's", "Cafe Coffee Day", "Burger King", "Pizza Hut", "Subway"],
    "Shopping": ["Amazon", "Flipkart", "Myntra", "DMart", "Blinkit", "Zepto", "Zara", "H&M", "Reliance Digital"],
    "Transport": ["Uber", "Ola Cabs", "Rapido", "Shell Petrol", "HP Fuel", "Namma Metro"],
    "Utilities": ["Jio Recharge", "Airtel Fiber", "Bescom Electricity", "Water Bill", "Indane Gas"],
    "Entertainment": ["Netflix", "Spotify", "PVR Cinemas", "BookMyShow", "Steam Games", "SonyLIV", "Amazon Prime"],
    "Health & Medical": ["Apollo Pharmacy", "Medplus", "Fortis Hospital", "1mg Diagnostics", "Dr. Batra Clinic"],
    "Education": ["Udemy", "Coursera", "Stationery Store", "Book Store"],
    "Travel": ["MakeMyTrip", "OYO Rooms", "Airbnb", "IRCTC Train Booking", "IndiGo Flight"],
    "Investments": ["Zerodha SIP", "Groww Mutual Fund", "PPF Deposit"],
    "Other": ["Local Kirana", "Laundry Service", "Saloon & Spa", "Miscellaneous", "Unknown Merchant"]
}

CREDIT_MERCHANTS = {
    "Salary": ["Employer Salary", "Consulting Fee", "Monthly Payout"],
    "Transfer": ["UPI Refund", "Cash Deposit", "Friend Transfer", "Reimbursement"],
    "Other": ["Interest Credit", "Dividend", "Cashback Rewards"]
}

# Chennai-centered category base coordinates
CHENNAI_CATEGORY_COORDS = {
    "Food & Dining": {"lat": 13.0827, "lng": 80.2707},
    "Transport": {"lat": 13.0674, "lng": 80.2376},
    "Shopping": {"lat": 13.0569, "lng": 80.2425},
    "Utilities": {"lat": 13.0878, "lng": 80.2785},
    "Healthcare": {"lat": 13.0524, "lng": 80.2503},
    "Health & Medical": {"lat": 13.0524, "lng": 80.2503},
    "Entertainment": {"lat": 13.0732, "lng": 80.2609},
    "Education": {"lat": 13.0389, "lng": 80.2619},
    "Travel": {"lat": 13.0450, "lng": 80.2250},
    "Investments": {"lat": 13.0650, "lng": 80.2550},
    "Other": {"lat": 13.0604, "lng": 80.2496},
    "Others": {"lat": 13.0604, "lng": 80.2496}
}


def get_random_amount(category: str, is_credit: bool) -> float:
    if is_credit:
        if category == "Salary":
            return round(random.uniform(40000, 95000), 2)
        else:
            return round(random.uniform(500, 5000), 2)
    
    # Debit amounts by category
    ranges = {
        "Food & Dining": (80, 1500),
        "Shopping": (200, 8000),
        "Transport": (50, 1200),
        "Utilities": (199, 3500),
        "Entertainment": (149, 2000),
        "Health & Medical": (100, 5000),
        "Education": (499, 10000),
        "Travel": (1000, 15000),
        "Investments": (1000, 10000),
        "Other": (50, 1000)
    }
    low, high = ranges.get(category, (50, 1500))
    # Occasional high transaction to trigger anomalies (e.g. 5% chance of spike)
    if random.random() < 0.05:
        return round(random.uniform(high * 2, high * 5), 2)
    return round(random.uniform(low, high), 2)

async def generate_simulated_txn(db: Session, account: Account, timestamp: datetime = None, is_initial: bool = False, force_debit: bool = False) -> Transaction:
    """Generates a random transaction for a simulated account and applies it."""
    # Determine type: 85% Debit, 15% Credit (unless it is initial sync where we might want mix)
    is_credit = False if force_debit else (random.random() < 0.15)
    
    if is_credit:
        category = random.choice(list(CREDIT_MERCHANTS.keys()))
        merchant = random.choice(CREDIT_MERCHANTS[category])
        txn_type = "CREDIT"
    else:
        category = random.choice(list(DEBIT_MERCHANTS.keys()))
        merchant = random.choice(DEBIT_MERCHANTS[category])
        txn_type = "DEBIT"
        
    amount = get_random_amount(category, is_credit)
    
    # Run AI Categorization
    ai_cat, ai_sub = categorize_transaction(merchant, amount)
    if ai_cat:
        category = ai_cat
        
    # Anomaly Detection
    is_anomaly, anomaly_score = check_anomaly(str(account.user_id), amount, merchant, db)
    
    ts = timestamp or datetime.utcnow()
    
    # Generate coordinates if DEBIT (expense)
    lat, lng = None, None
    if txn_type == "DEBIT":
        base_coord = CHENNAI_CATEGORY_COORDS.get(category) or CHENNAI_CATEGORY_COORDS.get("Other")
        lat = base_coord["lat"] + random.uniform(-0.015, 0.015)
        lng = base_coord["lng"] + random.uniform(-0.015, 0.015)
        
    txn = Transaction(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=amount,
        merchant=merchant,
        description=f"Simulated live transaction at {merchant}",
        category=category,
        subcategory=ai_sub,
        transaction_type=txn_type,
        timestamp=ts,
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
        is_recurring=False,
        latitude=lat,
        longitude=lng
    )
    db.add(txn)
    
    # Update account balance
    if txn_type == "DEBIT":
        account.balance = max(0.0, account.balance - amount)
        # Update budget
        update_budget_on_transaction(str(account.user_id), category, amount, db)
    else:
        account.balance += amount
        
    db.commit()
    db.refresh(txn)
    
    # Only notify and broadcast if it is NOT initial history seeding
    if not is_initial:
        # Create App Notification (automatically broadcasts via WebSocket "notification")
        notif_type = "success" if txn_type == "CREDIT" else ("danger" if is_anomaly else "info")
        title = "Live Sync: Money Received" if txn_type == "CREDIT" else "Live Sync: Money Spent"
        msg = f"Rs.{amount:,.2f} {'credited' if txn_type == 'CREDIT' else 'debited'} - {merchant} ({category})"
        if is_anomaly:
            msg += " [SUSPICIOUS ACTIVITY DETECTED]"
        create_notification(db, account.user_id, title, msg, notif_type)
        
        # Broadcast the transaction to force layout updates (using WebSocket "new_transaction")
        try:
            from app.api.notifications_api import ws_manager
        except ImportError:
            # Fallback to local import if manager name varies
            from app.api.notifications_api import manager as ws_manager
            
        try:
            await ws_manager.send_to_user(str(account.user_id), {
                "type": "new_transaction",
                "transaction": {
                    'id': str(txn.id),
                    'amount': txn.amount if txn.transaction_type == 'CREDIT' else -abs(txn.amount),
                    'merchant': txn.merchant,
                    'category': txn.category,
                    'transaction_type': txn.transaction_type,
                    'timestamp': str(txn.timestamp),
                    'latitude': txn.latitude,
                    'longitude': txn.longitude,
                }
            })
        except Exception as e:
            print(f"Failed to broadcast websocket transaction: {e}")
            
    return txn

async def seed_initial_history(db: Session, account: Account):
    """Seeds 35-50 historical transactions spread over the last 90 days to populate ML/Forecasting datasets."""
    num_txns = random.randint(35, 50)
    now = datetime.utcnow()
    
    # Spread transactions across the last 90 days
    for i in range(num_txns):
        offset_hours = random.randint(1, 90 * 24)
        ts = now - timedelta(hours=offset_hours)
        await generate_simulated_txn(db, account, timestamp=ts, is_initial=True)

async def run_simulation_tick():
    """Periodic tick called by the scheduler to roll random transactions for simulated accounts."""
    db = SessionLocal()
    try:
        # Find all active simulated accounts
        sim_accounts = db.query(Account).filter(
            Account.is_active == True,
            Account.account_token.like("simulated:%")
        ).all()
        
        for account in sim_accounts:
            # 20% chance to generate a transaction on each tick
            if random.random() < 0.20:
                await generate_simulated_txn(db, account)
    except Exception as e:
        print(f"Error in transaction simulation tick: {e}")
    finally:
        db.close()

