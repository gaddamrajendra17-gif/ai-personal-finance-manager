import pytest
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock
from app.models.finance import Account, Transaction, Budget
from app.models.user import User
from app.ai.chatbot import retrieve_relevant_transactions, get_financial_context, chat_with_ai, _rule_based_response

def test_retrieve_transactions_empty(db_session):
    txns = retrieve_relevant_transactions("pizza", str(uuid.uuid4()), db_session)
    assert len(txns) == 0

def test_retrieve_transactions_fallback_to_recent(db_session):
    user = User(email="chat1@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # 7 transactions
    for i in range(7):
        t = Transaction(account_id=account.id, amount=10.0 + i, merchant=f"Merchant {i}", transaction_type="DEBIT", timestamp=datetime.utcnow())
        db_session.add(t)
    db_session.commit()

    # Query with non-matching term should return top 5 most recent
    txns = retrieve_relevant_transactions("nonexistentterm", str(user.id), db_session)
    assert len(txns) == 5

def test_retrieve_transactions_keyword_match(db_session):
    user = User(email="chat2@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    t1 = Transaction(account_id=account.id, amount=100.0, merchant="Store", description="Swiggy dinner delivery", transaction_type="DEBIT", timestamp=datetime.utcnow())
    t2 = Transaction(account_id=account.id, amount=50.0, merchant="Store", description="Gas recharge", transaction_type="DEBIT", timestamp=datetime.utcnow())
    db_session.add(t1)
    db_session.add(t2)
    db_session.commit()

    txns = retrieve_relevant_transactions("swiggy", str(user.id), db_session)
    assert len(txns) == 1
    assert "Swiggy" in txns[0].description

def test_retrieve_transactions_merchant_keyword_match(db_session):
    user = User(email="chat3@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    t = Transaction(account_id=account.id, amount=100.0, merchant="McDonalds Outlet", description="Lunch", transaction_type="DEBIT", timestamp=datetime.utcnow())
    db_session.add(t)
    db_session.commit()

    txns = retrieve_relevant_transactions("mcdonalds", str(user.id), db_session)
    assert len(txns) == 1
    assert txns[0].merchant == "McDonalds Outlet"

def test_retrieve_transactions_category_keyword_match(db_session):
    user = User(email="chat4@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    t = Transaction(account_id=account.id, amount=100.0, merchant="Store", category="Healthcare", transaction_type="DEBIT", timestamp=datetime.utcnow())
    db_session.add(t)
    db_session.commit()

    txns = retrieve_relevant_transactions("healthcare", str(user.id), db_session)
    assert len(txns) == 1
    assert txns[0].category == "Healthcare"

def test_retrieve_transactions_cleans_punctuation(db_session):
    user = User(email="chat5@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    t = Transaction(account_id=account.id, amount=100.0, merchant="Zomato", description="Dining", transaction_type="DEBIT", timestamp=datetime.utcnow())
    db_session.add(t)
    db_session.commit()

    # Query with punctuation
    txns = retrieve_relevant_transactions("zomato!!!", str(user.id), db_session)
    assert len(txns) == 1
    assert txns[0].merchant == "Zomato"

def test_get_financial_context_structure(db_session):
    user = User(email="chat6@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    context = get_financial_context(str(user.id), db_session)
    assert "Current month:" in context
    assert "Monthly spending by category:" in context

def test_get_financial_context_with_budgets(db_session):
    user = User(email="chat7@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    
    now = datetime.utcnow()
    b = Budget(user_id=user.id, category="Food", limit_amount=1000.0, spent_amount=250.0, month=now.month, year=now.year)
    db_session.add(b)
    db_session.commit()

    context = get_financial_context(str(user.id), db_session)
    assert "Budget status:" in context
    assert "Food: ₹250.00 / ₹1000.00 (25%)" in context

def test_get_financial_context_category_totals(db_session):
    user = User(email="chat8@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    t = Transaction(account_id=account.id, amount=300.0, merchant="Store", category="Utilities", transaction_type="DEBIT", timestamp=datetime.utcnow())
    db_session.add(t)
    db_session.commit()

    context = get_financial_context(str(user.id), db_session)
    assert "Utilities: ₹300.00" in context

def test_rule_based_response_food():
    context = "Monthly spending by category:\n  - Food & Dining: ₹450.00"
    res = _rule_based_response("tell me about my food spending", context)
    assert "Food & Dining" in res
    assert "₹450.00" in res

def test_rule_based_response_budget():
    res = _rule_based_response("what is my budget?", "context")
    assert "budget status" in res

def test_rule_based_response_save():
    res = _rule_based_response("how can I save?", "context")
    assert "save more" in res

def test_rule_based_response_default():
    res = _rule_based_response("random question", "context")
    assert "rule-based fallback" in res

@patch("app.ai.agent.settings")
@pytest.mark.asyncio
async def test_chat_with_ai_fallback_triggered(mock_settings, db_session):
    mock_settings.ANTHROPIC_API_KEY = None
    mock_settings.OPENAI_API_KEY = None
    
    user_id = str(uuid.uuid4())
    res, thoughts, actions = await chat_with_ai(user_id, "hello", db_session)
    assert "LLM API key" in res

@patch("app.ai.agent.settings")
@patch("anthropic.Anthropic", create=True)
@pytest.mark.asyncio
async def test_chat_with_ai_anthropic_api(mock_anthropic_cls, mock_settings, db_session):
    mock_settings.ANTHROPIC_API_KEY = "dummy_key"
    mock_settings.OPENAI_API_KEY = None
    
    mock_client = MagicMock()
    mock_anthropic_cls.return_value = mock_client
    mock_message_inst = MagicMock()
    mock_content = MagicMock()
    mock_content.type = "text"
    mock_content.text = "Mock Claude Response"
    mock_message_inst.content = [mock_content]
    mock_client.messages.create.return_value = mock_message_inst

    user_id = str(uuid.uuid4())
    res, thoughts, actions = await chat_with_ai(user_id, "How is my budget?", db_session)
    assert res == "Mock Claude Response"

@patch("app.ai.agent.settings")
@patch("openai.OpenAI", create=True)
@pytest.mark.asyncio
async def test_chat_with_ai_openai_api(mock_openai_cls, mock_settings, db_session):
    mock_settings.ANTHROPIC_API_KEY = None
    mock_settings.OPENAI_API_KEY = "dummy_key"
    
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Mock GPT Response"))]
    mock_client.chat.completions.create.return_value = mock_response

    user_id = str(uuid.uuid4())
    res, thoughts, actions = await chat_with_ai(user_id, "How is my budget?", db_session)
    assert res == "Mock GPT Response"

@patch("app.ai.agent.settings")
@patch("anthropic.Anthropic", create=True, side_effect=Exception)
@patch("openai.OpenAI", create=True)
@pytest.mark.asyncio
async def test_chat_with_ai_anthropic_exception_falls_back_to_openai(mock_openai_cls, mock_anthropic_cls, mock_settings, db_session):
    mock_settings.ANTHROPIC_API_KEY = "dummy_key"
    mock_settings.OPENAI_API_KEY = "dummy_key"
    
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Mock GPT Response"))]
    mock_client.chat.completions.create.return_value = mock_response

    user_id = str(uuid.uuid4())
    res, thoughts, actions = await chat_with_ai(user_id, "How is my budget?", db_session)
    assert res == "Mock GPT Response"

@patch("app.ai.agent.settings")
@pytest.mark.asyncio
async def test_chat_with_ai_with_history(mock_settings, db_session):
    mock_settings.ANTHROPIC_API_KEY = None
    mock_settings.OPENAI_API_KEY = None
    
    history = [{"role": "user", "content": "hello"}, {"role": "assistant", "content": "hi"}]
    user_id = str(uuid.uuid4())
    res, thoughts, actions = await chat_with_ai(user_id, "how can I save?", db_session, chat_history=history)
    assert "LLM API key" in res or "save" in res
