import pytest
from unittest.mock import patch, MagicMock
from app.ai.categorizer import categorize_transaction, _rule_based_category

# --- Tier 1: Trained Model (ML) Tests ---

@patch("app.ai.categorizer._model")
@patch("app.ai.categorizer._vectorizer")
def test_tier1_food_dining(mock_vectorizer, mock_model):
    mock_vectorizer.vocabulary_ = {"swiggy": 1}
    mock_model.predict.return_value = ["Food & Dining"]
    cat, sub = categorize_transaction("Swiggy Order", 500.0)
    assert cat == "Food & Dining"

@patch("app.ai.categorizer._model")
@patch("app.ai.categorizer._vectorizer")
def test_tier1_healthcare_mapping(mock_vectorizer, mock_model):
    mock_vectorizer.vocabulary_ = {"hospital": 1}
    mock_model.predict.return_value = ["Healthcare"]
    cat, sub = categorize_transaction("Apollo Hospital", 1500.0)
    assert cat == "Health & Medical"

@patch("app.ai.categorizer._model")
@patch("app.ai.categorizer._vectorizer")
def test_tier1_others_mapping(mock_vectorizer, mock_model):
    mock_vectorizer.vocabulary_ = {"misc": 1}
    mock_model.predict.return_value = ["Others"]
    cat, sub = categorize_transaction("Misc Store", 100.0)
    assert cat == "Other"

@patch("app.ai.categorizer._model")
@patch("app.ai.categorizer._vectorizer")
def test_tier1_transport(mock_vectorizer, mock_model):
    mock_vectorizer.vocabulary_ = {"uber": 1}
    mock_model.predict.return_value = ["Transport"]
    cat, sub = categorize_transaction("Uber Ride", 300.0)
    assert cat == "Transport"

@patch("app.ai.categorizer._model")
@patch("app.ai.categorizer._vectorizer")
def test_tier1_entertainment(mock_vectorizer, mock_model):
    mock_vectorizer.vocabulary_ = {"netflix": 1}
    mock_model.predict.return_value = ["Entertainment"]
    cat, sub = categorize_transaction("Netflix Premium", 649.0)
    assert cat == "Entertainment"

# --- Tier 2: Keyword Fallback (Rule-Based) Tests ---

def test_tier2_food_zomato():
    cat, sub = _rule_based_category("Zomato Delivery", "")
    assert cat == "Food & Dining"

def test_tier2_rent_apartment():
    cat, sub = _rule_based_category("Rent Payment", "")
    assert cat == "Rent"

def test_tier2_transport_petrol():
    cat, sub = _rule_based_category("Petrol Pump", "")
    assert cat == "Transport"

def test_tier2_entertainment_spotify():
    cat, sub = _rule_based_category("Spotify Music", "")
    assert cat == "Entertainment"

def test_tier2_health_apollo():
    cat, sub = _rule_based_category("Apollo Chemist", "")
    assert cat == "Health & Medical"

def test_tier2_utilities_broadband():
    cat, sub = _rule_based_category("Broadband Internet", "")
    assert cat == "Utilities"

def test_tier2_shopping_amazon():
    cat, sub = _rule_based_category("Amazon Purchase", "")
    assert cat == "Shopping"

def test_tier2_emi_loan():
    cat, sub = _rule_based_category("Bajaj EMI Pay", "")
    assert cat == "EMI & Loans"

def test_tier2_travel_flight():
    cat, sub = _rule_based_category("Indigo Flight Ticket", "")
    assert cat == "Travel"

def test_tier2_education_coaching():
    cat, sub = _rule_based_category("Byju Learning Course", "")
    assert cat == "Education"

# --- Tier 3: SMS Vocabulary Fallback Tests ---

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_tier3_salary_sms():
    cat, sub = categorize_transaction("Salary Payroll", 75000.0)
    assert cat == "Salary"

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_tier3_generic_fallback_food():
    cat, sub = categorize_transaction("Pizza Inn", 800.0)
    assert cat == "Food & Dining"

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_tier3_health_pharmacist():
    # 'pharmacy' is in detect_category keywords
    cat, sub = categorize_transaction("My Pharmacy Store", 300.0)
    assert cat == "Health & Medical"

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_tier3_transport_ola():
    cat, sub = categorize_transaction("Ola Cab Trip", 400.0)
    assert cat == "Transport"

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_tier3_shopping_flipkart():
    cat, sub = categorize_transaction("Flipkart Order", 1200.0)
    assert cat == "Shopping"

# --- Boundary and Special Tests ---

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_categorize_empty_string():
    cat, sub = categorize_transaction("", 0.0)
    assert cat == "Other"

@patch("app.ai.categorizer._model", None)
@patch("app.ai.categorizer._vectorizer", None)
def test_categorize_completely_unknown():
    cat, sub = categorize_transaction("XYZABC123", 500.0)
    assert cat == "Other"

