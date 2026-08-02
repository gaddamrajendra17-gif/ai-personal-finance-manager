from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Account
from app.schemas.schemas import AccountCreate, AccountOut

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


async def seed_initial_history_background(account_id: str):
    from app.core.database import SessionLocal
    from app.services.simulation_service import seed_initial_history
    db = SessionLocal()
    try:
        account = db.query(Account).filter(Account.id == account_id).first()
        if account:
            await seed_initial_history(db, account)
    except Exception as e:
        print(f"Error in seeding history background: {e}")
    finally:
        db.close()


@router.get("/", response_model=List[AccountOut])
def get_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Account).filter(Account.user_id == current_user.id).all()


@router.post("/", response_model=AccountOut)
def create_account(
    data: AccountCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = Account(
        user_id=current_user.id,
        bank_name=data.bank_name,
        account_token=data.account_token,
        account_last4=data.account_last4,
        account_type=data.account_type,
        balance=data.balance,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    
    if account.account_token and account.account_token.startswith("simulated:"):
        background_tasks.add_task(seed_initial_history_background, str(account.id))
        
    return account


@router.put("/{account_id}/balance")
def update_balance(
    account_id: str,
    balance: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(
        Account.id == account_id, Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(404, "Account not found")
    account.balance = balance
    db.commit()
    return {"status": "updated", "balance": balance}


@router.get("/{account_id}", response_model=AccountOut)
def get_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(
        Account.id == account_id, Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(404, "Account not found")
    return account


@router.delete("/{account_id}")
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(Account).filter(
        Account.id == account_id, Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(404, "Account not found")
    
    # Delete associated recurring transactions
    from app.models.finance import RecurringTransaction
    db.query(RecurringTransaction).filter(RecurringTransaction.account_id == account.id).delete()
    
    db.delete(account)
    db.commit()
    return {"status": "deleted"}


@router.post("/{account_id}/auto-spend")
async def auto_spend_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a single simulated DEBIT (spending) transaction immediately for the specified account."""
    account = db.query(Account).filter(
        Account.id == account_id, Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(404, "Account not found")
        
    if not account.account_token or not account.account_token.startswith("simulated:"):
        raise HTTPException(400, "Only simulated accounts can automatically spend money")
        
    from app.services.simulation_service import generate_simulated_txn
    txn = await generate_simulated_txn(db, account, force_debit=True)
    return {
        "status": "success",
        "transaction_id": str(txn.id),
        "amount": txn.amount,
        "merchant": txn.merchant,
        "category": txn.category,
        "new_balance": account.balance
    }



