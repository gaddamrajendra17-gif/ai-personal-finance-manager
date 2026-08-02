from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
import re
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.ai.forecaster import forecast_expenses
from app.ai.chatbot import chat_with_ai, retrieve_relevant_transactions
from app.schemas.schemas import ChatMessage, ChatResponse

forecast_router = APIRouter(prefix="/api/forecast", tags=["Forecasting"])
chat_router = APIRouter(prefix="/api/chat", tags=["AI Chatbot"])

# In-memory chat history (use Redis for production)
_chat_histories: dict = {}


@forecast_router.get("/")
def get_forecast(
    periods: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get expense forecast for next N days using Prophet."""
    return forecast_expenses(str(current_user.id), db, periods)


@chat_router.post("/", response_model=ChatResponse)
async def chat(
    body: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat with AI financial assistant."""
    user_id = str(current_user.id)
    history = _chat_histories.get(user_id, [])

    response, thoughts, actions = await chat_with_ai(user_id, body.message, db, history)
    txns = retrieve_relevant_transactions(body.message, user_id, db)

    # Update history
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": response})
    _chat_histories[user_id] = history[-20:]  # Keep last 20 messages

    suggestions = []
    msg_lower = body.message.lower()
    if "food" in msg_lower:
        suggestions = ["Show my food budget", "How to reduce food spending?", "What did I spend last month?"]
    elif "save" in msg_lower:
        suggestions = ["Set a savings goal", "Simulate my savings", "Show budget recommendations"]

    return ChatResponse(
        response=response,
        suggestions=suggestions,
        relevant_transactions=txns,
        thoughts=thoughts,
        actions=actions
    )


@chat_router.delete("/history")
def clear_chat_history(current_user: User = Depends(get_current_user)):
    """Clear chat history for current user."""
    _chat_histories.pop(str(current_user.id), None)
    return {"status": "cleared"}


class VoiceParseRequest(BaseModel):
    transcript: str


@chat_router.post("/voice/parse")
def parse_voice_transcript(
    payload: VoiceParseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Parse a voice transcript using Stanza NLP / Rule-based fallback.
    Extracts amount, merchant, type, category, and description.
    """
    text = payload.transcript.lower()
    amount = 0.0
    merchant = ""
    txn_type = "DEBIT"
    
    # 1. Attempt Stanza parsing
    stanza_success = False
    try:
        import stanza
        import os
        # Check if local model directory exists to prevent network downloads and hangs
        resources_path = os.path.expanduser("~/stanza_resources/en")
        if os.path.exists(resources_path):
            nlp = stanza.Pipeline(lang='en', processors='tokenize,pos,ner', download_method=None, verbose=False)
            doc = nlp(payload.transcript)
            
            proper_nouns = []
            numbers = []
            for sentence in doc.sentences:
                for word in sentence.words:
                    if word.upos == "PROPN" and word.text.lower() not in ["rupees", "rs", "inr"]:
                        proper_nouns.append(word.text)
                    elif word.upos == "NUM":
                        try:
                            numbers.append(float(word.text.replace(",", "")))
                        except ValueError:
                            pass
                            
            if proper_nouns:
                merchant = " ".join(proper_nouns)
                stanza_success = True
            if numbers:
                amount = numbers[0]
                stanza_success = True
    except Exception:
        pass

    # 2. Heuristics regex fallback
    if not stanza_success or not merchant:
        # Extract amount
        amount_match = re.search(r"(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr)?", text) or \
                       re.search(r"(?:rupees?|rs\.?|inr\.?)\s*(\d+(?:\.\d{1,2})?)", text)
        if amount_match:
            amount = float(amount_match.group(1))
            
        # Extract merchant from words after "for", "at", "to", "from", "on"
        for_match = re.search(r"(?:for|at|to|from|on)\s+([a-zA-Z\s0-9]+?)(?:\s+food|\s+shopping|\s+bill|$)", text)
        if for_match:
            words = for_match.group(1).strip().split()
            merchant = " ".join(words[:2]).capitalize()

    # Clean merchant name
    from app.ai.ocr_parser import COMMON_MERCHANTS
    matched_common = None
    for m in COMMON_MERCHANTS:
        if m in merchant.lower() or m in text:
            matched_common = m.capitalize()
            break
            
    if matched_common:
        merchant = matched_common
    elif not merchant or merchant.lower() in ["rupees", "rs", "inr", "unknown"]:
        merchant = "Store Purchase"
            
    # Detect transaction type
    is_credit = any(w in text for w in ["received", "credited", "got", "income", "salary", "earned", "credit", "add deposit"])
    if is_credit:
        txn_type = "CREDIT"
        
    # Use categorizer
    from app.ai.categorizer import categorize_transaction
    category, _ = categorize_transaction(merchant, amount, payload.transcript)
    
    desc = f"Voice logged transaction at {merchant}"
    
    return {
        "success": True,
        "parsed": {
            "amount": amount if txn_type == "CREDIT" else -amount,
            "merchant": merchant,
            "category": category,
            "type": txn_type,
            "description": desc
        },
        "method": "Stanza NLP" if stanza_success else "NLP Heuristics Fallback"
    }
