import pytest
from unittest.mock import patch, MagicMock
from app.ai.forecaster import LSTMSequencePredictor, forecast_expenses
from app.ai.ocr_parser import parse_receipt_image
from app.ai.categorizer import categorize_transaction
import numpy as np

# 1. Test LSTM Sequence Predictor
def test_lstm_sequence_predictor():
    predictor = LSTMSequencePredictor(sequence_length=3)
    history = np.array([100.0, 150.0, 200.0, 250.0, 300.0])
    predictor.fit(history)
    predictions = predictor.predict(history, steps=2)
    
    assert len(predictions) == 2
    assert all(p >= 0.0 for p in predictions)


# 2. Test OCR parsing heuristics
def test_ocr_metadata_parsing_from_filename():
    # Test merchant extraction
    res1 = parse_receipt_image("dummy_path/Swiggy_Rs_540.jpg")
    assert res1["merchant"] == "Swiggy"
    assert res1["amount"] == 540.0
    assert res1["category"] == "Food & Dining"
    
    # Test fallback random generation when details are missing
    res2 = parse_receipt_image("dummy_path/receipt.png")
    assert res2["merchant"] == "Store Purchase"
    assert res2["amount"] > 0.0
    assert res2["category"] == "Shopping"


# 3. Test Voice Parsing Endpoint
def test_voice_nlp_fallback_parsing():
    from app.api.ai_routes import parse_voice_transcript, VoiceParseRequest
    
    # Mock payload
    payload = VoiceParseRequest(transcript="Paid 450 rupees for Starbucks coffee")
    
    # We call the parser helper directly
    db_mock = MagicMock()
    user_mock = MagicMock()
    
    res = parse_voice_transcript(payload, db=db_mock, current_user=user_mock)
    
    assert res["success"] is True
    assert res["parsed"]["merchant"] == "Starbucks"
    assert abs(res["parsed"]["amount"]) == 450.0
    assert res["parsed"]["type"] == "DEBIT"
    assert res["parsed"]["category"] == "Food & Dining"


# 4. Test Group Split Expense logic
def test_group_split_serialization():
    from app.api.groups import serialize_group
    from app.models.finance import Group, GroupMember, GroupExpense, Settlement
    import json
    from datetime import datetime

    # Mock Group
    group = Group(id="group-123", name="Trip")
    group.created_at = datetime.now()
    group.members = [
        GroupMember(name="You"),
        GroupMember(name="Rahul")
    ]
    group.expenses = [
        GroupExpense(
            id="exp-456",
            description="Lunch",
            amount=600.0,
            paid_by="Rahul",
            split_with=json.dumps(["You"]),
            date="28/05/2026",
            settlements=[
                Settlement(from_member="You", to_member="Rahul", amount=300.0, settled=False)
            ]
        )
    ]
    
    serialized = serialize_group(group)
    assert serialized["name"] == "Trip"
    assert "You" in serialized["members"]
    assert len(serialized["expenses"]) == 1
    assert serialized["expenses"][0]["perPerson"] == 300.0
    assert serialized["expenses"][0]["settlements"][0]["from"] == "You"
    assert serialized["expenses"][0]["settlements"][0]["settled"] is False

