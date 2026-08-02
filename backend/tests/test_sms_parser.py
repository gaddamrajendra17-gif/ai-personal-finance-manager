import pytest
from app.api.sms_receiver import parse_bank_sms, detect_category

# --- SBI SMS Tests ---
def test_sbi_debit():
    res = parse_bank_sms("Your SBI a/c XXXX1234 debited Rs.850 on 16-03-26 to Swiggy UPI.", "SBI-ALERT")
    assert res is not None
    assert res["amount"] == -850.0
    assert res["type"] == "DEBIT"
    assert res["merchant"] == "Swiggy"
    assert res["category"] == "Food & Dining"

def test_sbi_credit():
    res = parse_bank_sms("Rs.15000 credited to your SBI a/c XXXX1234 from EMPLOYER SALARY on 16-03-26.", "SBI-ALERT")
    assert res is not None
    assert res["amount"] == 15000.0
    assert res["type"] == "CREDIT"
    assert res["merchant"] == "Employer Salary"
    assert res["category"] == "Salary"

def test_sbi_debit_inr():
    res = parse_bank_sms("Your SBI a/c XXXX1234 debited INR 500.50 to Ola Cabs.", "SBI-ALERT")
    assert res is not None
    assert res["amount"] == -500.50
    assert res["type"] == "DEBIT"
    assert res["merchant"] == "Ola Cabs"
    assert res["category"] == "Transport"

def test_sbi_credit_simple():
    res = parse_bank_sms("Your SBI a/c XXXX1234 received Rs.2000 from Dad.", "SBI-ALERT")
    assert res is not None
    assert res["amount"] == 2000.0
    assert res["type"] == "CREDIT"

# --- HDFC SMS Tests ---
def test_hdfc_debit():
    res = parse_bank_sms("Your HDFC Bank a/c XX1234 debited by Rs.1200 on 16/03/26. Info: UPI/AMAZON.", "HDFC-BANK")
    assert res is not None
    assert res["amount"] == -1200.0
    assert res["type"] == "DEBIT"
    assert res["merchant"] == "Amazon"
    assert res["category"] == "Shopping"

def test_hdfc_credit():
    res = parse_bank_sms("Rs.5000.00 credited to HDFC Bank a/c XX1234 on 16/03/26. Ref: Refund.", "HDFC-BANK")
    assert res is not None
    assert res["amount"] == 5000.0
    assert res["type"] == "CREDIT"

def test_hdfc_debit_spent():
    res = parse_bank_sms("Spent Rs.450 at Starbucks on HDFC Card.", "HDFC")
    assert res is not None
    assert res["amount"] == -450.0
    assert res["merchant"] == "Starbucks"
    assert res["category"] == "Food & Dining"

def test_hdfc_credit_deposited():
    res = parse_bank_sms("Deposited Rs.10000 in HDFC Bank a/c XX1234.", "HDFC")
    assert res is not None
    assert res["amount"] == 10000.0
    assert res["type"] == "CREDIT"

# --- ICICI SMS Tests ---
def test_icici_debit():
    res = parse_bank_sms("Your ICICI Bank a/c XX345 debited for Rs.750. Info: Zomato.", "ICICI-ALERT")
    assert res is not None
    assert res["amount"] == -750.0
    assert res["type"] == "DEBIT"
    assert res["merchant"] == "Zomato"
    assert res["category"] == "Food & Dining"

def test_icici_credit():
    res = parse_bank_sms("Your ICICI Bank a/c XX345 credited with Rs.3500. Ref: Cashback.", "ICICI-ALERT")
    assert res is not None
    assert res["amount"] == 3500.0
    assert res["type"] == "CREDIT"

def test_icici_withdrawn():
    res = parse_bank_sms("Withdrawn Rs.5000 from ICICI ATM.", "ICICI")
    assert res is not None
    assert res["amount"] == -5000.0
    assert res["type"] == "DEBIT"

def test_icici_refund():
    res = parse_bank_sms("Refunded Rs.120 to ICICI a/c.", "ICICI")
    assert res is not None
    assert res["amount"] == 120.0
    assert res["type"] == "CREDIT"

# --- Axis SMS Tests ---
def test_axis_debit():
    res = parse_bank_sms("Axis Bank a/c XX123 debited by Rs.99 at Netflix.", "AXIS-BANK")
    assert res is not None
    assert res["amount"] == -99.0
    assert res["merchant"] == "Netflix"
    assert res["category"] == "Entertainment"

def test_axis_credit():
    res = parse_bank_sms("Axis Bank a/c XX123 credited by Rs.45000.", "AXIS-BANK")
    assert res is not None
    assert res["amount"] == 45000.0
    assert res["type"] == "CREDIT"

def test_axis_deducted():
    res = parse_bank_sms("Deducted Rs.200 from Axis a/c.", "AXIS")
    assert res is not None
    assert res["amount"] == -200.0
    assert res["type"] == "DEBIT"

def test_axis_added():
    res = parse_bank_sms("Added Rs.150 to Axis Wallet.", "AXIS")
    assert res is not None
    assert res["amount"] == 150.0
    assert res["type"] == "CREDIT"

# --- Kotak SMS Tests ---
def test_kotak_debit():
    res = parse_bank_sms("Kotak Bank a/c XX678 debited by Rs.600 to Uber.", "KOTAK-BANK")
    assert res is not None
    assert res["amount"] == -600.0
    assert res["merchant"] == "Uber"
    assert res["category"] == "Transport"

def test_kotak_credit():
    res = parse_bank_sms("Kotak Bank a/c XX678 credited with Rs.1200.", "KOTAK-BANK")
    assert res is not None
    assert res["amount"] == 1200.0
    assert res["type"] == "CREDIT"

def test_kotak_paid():
    res = parse_bank_sms("Paid Rs.350 to Cafe Coffee Day via Kotak.", "KOTAK")
    assert res is not None
    assert res["amount"] == -350.0
    assert res["merchant"] == "Cafe Coffee Day"

def test_kotak_received():
    res = parse_bank_sms("Received Rs.800 in Kotak a/c.", "KOTAK")
    assert res is not None
    assert res["amount"] == 800.0
    assert res["type"] == "CREDIT"

# --- PNB SMS Tests ---
def test_pnb_debit():
    res = parse_bank_sms("PNB account XX098 debited Rs.450 at Apollo Pharmacy.", "PNB-ALERT")
    assert res is not None
    assert res["amount"] == -450.0
    assert res["merchant"] == "Apollo Pharmacy"
    assert res["category"] == "Health & Medical"

def test_pnb_credit():
    res = parse_bank_sms("PNB account XX098 credited Rs.25000.", "PNB-ALERT")
    assert res is not None
    assert res["amount"] == 25000.0
    assert res["type"] == "CREDIT"

# --- Generic & Edge Tests ---
def test_generic_debit():
    res = parse_bank_sms("Your account XX456 debited Rs.300 to Airtel Broadband.", "UNKNOWN-SENDER")
    assert res is not None
    assert res["amount"] == -300.0
    assert res["merchant"] == "Airtel Broadband"
    assert res["category"] == "Utilities"

def test_generic_credit():
    res = parse_bank_sms("Your account XX456 received Rs.500.", "UNKNOWN-SENDER")
    assert res is not None
    assert res["amount"] == 500.0
    assert res["type"] == "CREDIT"

def test_invalid_sms():
    res = parse_bank_sms("Hey, are we still meeting today at 5?", "FRIEND")
    assert res is None

def test_missing_amount():
    res = parse_bank_sms("Your account XX123 has been debited. Please check balance.", "BANK")
    assert res is None

def test_both_keywords_debit_first():
    # Both keywords, but debited appears first
    res = parse_bank_sms("Your account XX123 was debited Rs.100. Credited transactions will update soon.", "BANK")
    assert res is not None
    assert res["type"] == "DEBIT"
    assert res["amount"] == -100.0

def test_both_keywords_credit_first():
    # Both keywords, but credited appears first
    res = parse_bank_sms("Your account XX123 was credited Rs.500. Debited amounts are pending.", "BANK")
    assert res is not None
    assert res["type"] == "CREDIT"
    assert res["amount"] == 500.0

# --- Category Detector Tests ---
def test_detect_category_food():
    cat = detect_category("Spent Rs.500 on dinner at Zomato", "Zomato")
    assert cat == "Food & Dining"

def test_detect_category_other():
    cat = detect_category("Spent Rs.500 on items at XYZStore", "XYZStore")
    assert cat == "Others"
