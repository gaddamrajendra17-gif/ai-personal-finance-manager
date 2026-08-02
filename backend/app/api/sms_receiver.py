from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import re, uuid
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.finance import Transaction, Account
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/sms", tags=["sms"])

def parse_bank_sms(sms_text: str, sender: Optional[str] = None) -> Optional[dict]:
    text = sms_text.upper()
    
    # Polarity detection based on exact paper keywords
    debit_keywords = ["DEBITED", "WITHDRAWN", "PAID", "DEDUCTED", "SPENT", "DEBIT"]
    credit_keywords = ["CREDITED", "RECEIVED", "DEPOSITED", "REFUNDED", "ADDED", "CREDIT"]
    
    is_debit = any(k in text for k in debit_keywords)
    is_credit = any(k in text for k in credit_keywords)
    
    if not is_debit and not is_credit:
        return None
        
    # In case both keywords are present, prioritize by order of occurrence
    if is_debit and is_credit:
        debit_idx = min([text.find(k) for k in debit_keywords if text.find(k) != -1], default=9999)
        credit_idx = min([text.find(k) for k in credit_keywords if text.find(k) != -1], default=9999)
        if debit_idx < credit_idx:
            is_credit = False
        else:
            is_debit = False

    # Determine bank institution from sender ID or message text
    sender_upper = (sender or "").upper()
    if "SBI" in sender_upper or "SBI" in text:
        bank = "SBI"
    elif "HDFC" in sender_upper or "HDFC" in text:
        bank = "HDFC"
    elif "ICICI" in sender_upper or "ICICI" in text:
        bank = "ICICI"
    elif "AXIS" in sender_upper or "AXIS" in text:
        bank = "AXIS"
    elif "KOTAK" in sender_upper or "KOTAK" in text:
        bank = "KOTAK"
    elif "PNB" in sender_upper or "PNB" in text:
        bank = "PNB"
    else:
        bank = "GENERIC"

    amount = None
    merchant = "Unknown"

    if is_credit:
        prepositions = ["FROM", "VIA", "AT", "TO", "FOR"]
    else:
        prepositions = ["TO", "AT", "FOR", "VIA", "FROM"]

    # Bank-specific regex parsing branches
    amt_match = re.search(r'(?:RS\.?|INR)\s*([0-9,]+(?:\.[0-9]{1,2})?)', text)
    if amt_match:
        amount = float(amt_match.group(1).replace(",", ""))
    
    for prep in prepositions:
        m_match = re.search(rf'\b{prep}\s+([A-Z0-9\s\-\*]+?)(?:\s+ON|\s+REF|\s+A/C|\s+UPI|\bINFO\b|\bVIA\b|\.|$)', text)
        if m_match:
            merchant = m_match.group(1).strip()
            break

    if merchant == "Unknown" or merchant == "" or merchant.upper() in ["RS", "INR"] or re.match(r'^[0-9.,\s]+$', merchant):
        info_match = re.search(r'\b(?:INFO|REF|UPI)\s*[:/]?\s*(?:UPI\s*/)?\s*([A-Z0-9\-\*]+)', text)
        if info_match:
            merchant = info_match.group(1).strip()

    if not amount:
        return None

    if merchant and merchant != "Unknown":
        clean_merchant = re.sub(r'^(?:TRANSACTION|TXN|PAYMENT|SPENT|TRANSFER|TRF)\s+(?:AT|TO|FROM|VIA|FOR)\s+', '', merchant, flags=re.IGNORECASE)
        clean_merchant = re.sub(r'\s+(?:REF|ON|DATE|A/C|UPI|INFO|CARD|LIMIT|BAL).*$', '', clean_merchant, flags=re.IGNORECASE)
        merchant = clean_merchant.strip().title()

    category = detect_category(text, merchant)
    return {
        "amount": amount if is_credit else -amount,
        "type": "CREDIT" if is_credit else "DEBIT",
        "merchant": merchant,
        "category": category,
        "description": f"{'Received from' if is_credit else 'Paid to'} {merchant}",
        "raw_sms": sms_text[:200],
    }

def detect_category(text: str, merchant: str) -> str:
    categories = {
        "Food & Dining": ["SWIGGY","ZOMATO","RESTAURANT","HOTEL","CAFE","FOOD","DINING","PIZZA","BURGER","STARBUCKS"],
        "Shopping": ["AMAZON","FLIPKART","MYNTRA","SHOP","STORE","MALL","MARKET"],
        "Transport": ["OLA","UBER","RAPIDO","METRO","BUS","PETROL","FUEL","DIESEL"],
        "Utilities": ["ELECTRICITY","WATER","GAS","INTERNET","BROADBAND","AIRTEL","JIO","BSNL"],
        "Health & Medical": ["HOSPITAL","CLINIC","PHARMACY","MEDICAL","DOCTOR","HEALTH"],
        "Entertainment": ["NETFLIX","HOTSTAR","PRIME","CINEMA","MOVIE","THEATRE"],
        "Education": ["SCHOOL","COLLEGE","UNIVERSITY","COURSE","FEES","TUITION"],
        "Transfer": ["UPI","NEFT","IMPS","RTGS","TRANSFER"],
        "Salary": ["SALARY","PAYROLL","WAGES"],
    }
    combined = text + " " + merchant.upper()
    for category, kws in categories.items():
        for kw in kws:
            if re.search(r'\b' + re.escape(kw) + r'\b', combined):
                return category
    return "Others"

class SMSPayload(BaseModel):
    phone: str
    message: str
    sender: Optional[str] = None
    timestamp: Optional[str] = None

class SMSParseRequest(BaseModel):
    sms_text: str
    sender: Optional[str] = None

from app.services.budget_service import update_budget_on_transaction

@router.post("/webhook")
async def sms_webhook(payload: SMSPayload, db: Session = Depends(get_db)):
    parsed = parse_bank_sms(payload.message, payload.sender)
    if not parsed:
        return {"success": False, "message": "Not a bank transaction SMS"}
    
    user = None
    if payload.phone:
        user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        user = db.query(User).filter(User.email == "demo@pfm.com").first()
        
    if not user:
        return {"success": False, "message": "User not found"}
    account = db.query(Account).filter(Account.user_id == user.id, Account.is_active == True).first()
    if not account:
        return {"success": False, "message": "No account found"}
        
    abs_amount = abs(parsed["amount"])
    txn = Transaction(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=abs_amount,
        category=parsed["category"],
        description=parsed["description"],
        merchant=parsed["merchant"],
        transaction_type=parsed["type"],
        timestamp=datetime.utcnow(),
    )
    db.add(txn)
    
    if parsed["type"] == "DEBIT":
        account.balance -= abs_amount
        update_budget_on_transaction(str(user.id), parsed["category"], abs_amount, db)
    else:
        account.balance += abs_amount
        
    db.commit()

    # Broadcast transaction over WebSocket
    try:
        from app.api.notifications_api import manager as ws_manager
        await ws_manager.send_to_user(str(user.id), {
            "type": "new_transaction",
            "transaction": {
                'id': str(txn.id),
                'amount': txn.amount if txn.transaction_type == 'CREDIT' else -abs(txn.amount),
                'merchant': txn.merchant,
                'category': txn.category,
                'transaction_type': txn.transaction_type,
                'timestamp': str(txn.timestamp),
            }
        })
    except Exception:
        pass

    notif_type = "success" if parsed["type"] == "CREDIT" else "warning"
    title = "Money Received" if parsed["type"] == "CREDIT" else "Money Spent"
    msg = f"Rs.{abs_amount:,.0f} {'credited' if parsed["type"] == 'CREDIT' else 'debited'} - {parsed['merchant']}"
    create_notification(db, user.id, title, msg, notif_type)
    return {"success": True, "message": "Transaction created", "transaction": {"amount": abs_amount, "category": parsed["category"], "merchant": parsed["merchant"]}}

@router.post("/parse")
def parse_sms(req: SMSParseRequest):
    parsed = parse_bank_sms(req.sms_text, req.sender)
    if not parsed:
        return {"success": False, "message": "Could not parse as bank transaction"}
    return {"success": True, "parsed": parsed}

@router.get("/webhook-url")
def get_webhook_url(request: Request):
    base = str(request.base_url).rstrip("/")
    return {"webhook_url": f"{base}/api/sms/webhook", "method": "POST", "content_type": "application/json", "body_template": "{\"phone\": \"%from%\", \"message\": \"%body%\"}"}
