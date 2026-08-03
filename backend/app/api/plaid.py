import os
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Account, Transaction
from app.services.simulation_service import seed_initial_history, generate_simulated_txn
from app.ai.categorizer import categorize_transaction
from app.ai.anomaly_detector import check_anomaly
from app.services.budget_service import update_budget_on_transaction

router = APIRouter(prefix="/api/plaid", tags=["Plaid / Sync"])

PLAID_CLIENT_ID = os.environ.get("PLAID_CLIENT_ID")
PLAID_SECRET = os.environ.get("PLAID_SECRET")
PLAID_ENV = os.environ.get("PLAID_ENV", "sandbox")

PLAID_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com"
}
PLAID_BASE_URL = PLAID_URLS.get(PLAID_ENV, "https://sandbox.plaid.com")

class PlaidConfigOut(BaseModel):
    enabled: bool
    env: str

class PublicTokenExchange(BaseModel):
    public_token: str
    institution_name: str
    account_name: Optional[str] = None
    account_type: Optional[str] = "savings"
    account_last4: Optional[str] = None
    balance: Optional[float] = 15000.0

class LinkTokenCreateOut(BaseModel):
    link_token: str

class SyncRequest(BaseModel):
    account_id: str

@router.get("/config", response_model=PlaidConfigOut)
def get_plaid_config():
    """Checks if Plaid credentials are configured on the backend."""
    enabled = bool(PLAID_CLIENT_ID and PLAID_SECRET)
    return {"enabled": enabled, "env": PLAID_ENV}

@router.post("/create_link_token", response_model=LinkTokenCreateOut)
async def create_link_token(current_user: User = Depends(get_current_user)):
    """Creates a Plaid Link Token. Falls back to a mock link token if Plaid is disabled."""
    if not PLAID_CLIENT_ID or not PLAID_SECRET:
        # Return a mock token for the frontend's simulated Plaid flow
        return {"link_token": f"mock_plaid_link_token_{uuid.uuid4().hex}"}

    url = f"{PLAID_BASE_URL}/link/token/create"
    payload = {
        "client_id": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
        "client_name": "AI Personal Finance Manager",
        "language": "en",
        "country_codes": ["US"],
        "user": {
            "client_user_id": str(current_user.id)
        },
        "products": ["transactions"]
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, headers={"Plaid-Version": "2020-09-14"})
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Plaid Error: {res.text}")
            data = res.json()
            return {"link_token": data["link_token"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Plaid: {str(e)}")

@router.post("/exchange_public_token")
async def exchange_public_token(
    data: PublicTokenExchange,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exchanges a Plaid public token for an access token.
    If the public token is mock (simulation mode), we seed a simulated account.
    """
    is_mock = data.public_token.startswith("mock_")
    
    if is_mock:
        # Create a simulated account
        if data.public_token.startswith("mock_direct_"):
            bank_key = data.institution_name.lower().replace(" ", "_")
            token = f"simulated:{bank_key}:{uuid.uuid4().hex}"
        else:
            token = f"simulated:plaid:{uuid.uuid4().hex}"
            
        account = Account(
            id=uuid.uuid4(),
            user_id=current_user.id,
            bank_name=data.institution_name,
            account_token=token,
            account_last4=data.account_last4 or str(uuid.uuid4().int)[:4],
            account_type=data.account_type or "savings",
            balance=data.balance or 25000.0,
            is_active=True
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        
        # Seed initial history in background to prevent request timeout
        background_tasks.add_task(seed_initial_history, db, account)
        return {"status": "success", "account_id": str(account.id), "simulated": True}

    # Real Plaid Token Exchange
    url = f"{PLAID_BASE_URL}/item/public_token/exchange"
    payload = {
        "client_id": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
        "public_token": data.public_token
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, headers={"Plaid-Version": "2020-09-14"})
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Plaid exchange failed: {res.text}")
            
            plaid_data = res.json()
            access_token = plaid_data["access_token"]
            item_id = plaid_data["item_id"]
            
            # Fetch Account Details from Plaid
            acc_url = f"{PLAID_BASE_URL}/accounts/get"
            acc_res = await client.post(acc_url, json={
                "client_id": PLAID_CLIENT_ID,
                "secret": PLAID_SECRET,
                "access_token": access_token
            }, headers={"Plaid-Version": "2020-09-14"})
            
            if acc_res.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch account info from Plaid")
                
            acc_data = acc_res.json()
            
            created_accounts = []
            for item in acc_data.get("accounts", []):
                plaid_acc_id = item["account_id"]
                custom_token = f"plaid:{access_token}:{plaid_acc_id}"
                
                # Check if already exists
                existing = db.query(Account).filter(Account.account_token == custom_token).first()
                if existing:
                    continue
                    
                balances = item.get("balances", {})
                current_bal = balances.get("current", 0.0)
                
                account = Account(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    bank_name=data.institution_name or "Plaid Account",
                    account_token=custom_token,
                    account_last4=item.get("mask"),
                    account_type=item.get("subtype", "checking"),
                    balance=current_bal,
                    is_active=True
                )
                db.add(account)
                created_accounts.append(account)
                
            db.commit()
            
            # Background task: sync initial Plaid transactions
            if created_accounts:
                background_tasks.add_task(sync_plaid_transactions_for_item, db, access_token, current_user.id)
                
            return {"status": "success", "accounts": [str(a.id) for a in created_accounts], "simulated": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plaid request failed: {str(e)}")

@router.post("/sync-simulated")
async def sync_simulated_account(
    data: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Triggers an immediate transaction sync for simulated accounts, generating 1-3 new transactions."""
    account = db.query(Account).filter(
        Account.id == data.account_id,
        Account.user_id == current_user.id
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if not account.account_token.startswith("simulated:"):
        raise HTTPException(status_code=400, detail="Not a simulated account")

    # Generate 1 to 3 random transactions
    txns_created = []
    num_txns = random_choice_weighted()
    for _ in range(num_txns):
        txn = await generate_simulated_txn(db, account)
        txns_created.append(txn)

    return {
        "status": "synchronized",
        "transactions_added": len(txns_created),
        "new_balance": account.balance
    }

def random_choice_weighted() -> int:
    import random
    # 50% chance of 1, 35% chance of 2, 15% chance of 3
    return random.choices([1, 2, 3], weights=[50, 35, 15])[0]

async def sync_plaid_transactions_for_item(db: Session, access_token: str, user_id: uuid.UUID):
    """Utility to sync transactions from Plaid using its direct API endpoint."""
    url = f"{PLAID_BASE_URL}/transactions/sync"
    payload = {
        "client_id": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
        "access_token": access_token
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, headers={"Plaid-Version": "2020-09-14"})
            if res.status_code != 200:
                print(f"Plaid transaction sync failed: {res.text}")
                return
                
            data = res.json()
            added = data.get("added", [])
            
            for item in added:
                plaid_acc_id = item["account_id"]
                custom_token = f"plaid:{access_token}:{plaid_acc_id}"
                
                account = db.query(Account).filter(Account.account_token == custom_token).first()
                if not account:
                    continue
                    
                # Create Transaction record
                amount = float(item["amount"])
                merchant = item.get("merchant_name") or item.get("name") or "Unknown"
                description = item.get("name")
                
                # Plaid amounts: positive for debit, negative for credit
                txn_type = "DEBIT" if amount > 0 else "CREDIT"
                abs_amount = abs(amount)
                
                # Check for existing txn
                existing = db.query(Transaction).filter(
                    Transaction.account_id == account.id,
                    Transaction.merchant == merchant,
                    Transaction.amount == abs_amount,
                    Transaction.timestamp == datetime.strptime(item["date"], "%Y-%m-%d")
                ).first()
                
                if existing:
                    continue
                    
                # AI Categorizer
                ai_cat, ai_sub = categorize_transaction(merchant, abs_amount, description)
                
                # Anomaly check
                is_anomaly, anomaly_score = check_anomaly(str(user_id), abs_amount, merchant, db)
                
                # Generate coordinate offsets for map visualization
                lat, lng = None, None
                if txn_type == "DEBIT":
                    import random
                    from app.services.simulation_service import CHENNAI_CATEGORY_COORDS
                    base_coord = CHENNAI_CATEGORY_COORDS.get(ai_cat) or CHENNAI_CATEGORY_COORDS.get("Other")
                    lat = base_coord["lat"] + random.uniform(-0.015, 0.015)
                    lng = base_coord["lng"] + random.uniform(-0.015, 0.015)

                txn = Transaction(
                    id=uuid.uuid4(),
                    account_id=account.id,
                    amount=abs_amount,
                    merchant=merchant,
                    description=description,
                    category=ai_cat,
                    subcategory=ai_sub,
                    transaction_type=txn_type,
                    timestamp=datetime.strptime(item["date"], "%Y-%m-%d"),
                    is_anomaly=is_anomaly,
                    anomaly_score=anomaly_score,
                    latitude=lat,
                    longitude=lng
                )
                db.add(txn)
                
                # Adjust balance
                if txn_type == "DEBIT":
                    account.balance = max(0.0, account.balance - abs_amount)
                    update_budget_on_transaction(str(user_id), ai_cat, abs_amount, db)
                else:
                    account.balance += abs_amount
                    
            db.commit()
    except Exception as e:
        print(f"Error executing Plaid transaction sync: {e}")

