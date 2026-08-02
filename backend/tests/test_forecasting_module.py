import pytest
import uuid
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from app.models.finance import Account, Transaction, Forecast
from app.models.user import User
from app.ai.forecaster import get_user_daily_spending, forecast_expenses

def test_forecast_no_user_accounts(db_session):
    user_id = str(uuid.uuid4())
    df = get_user_daily_spending(user_id, db_session)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 0

def test_forecast_insufficient_data(db_session):
    user = User(email="forecast1@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    res = forecast_expenses(str(user.id), db_session)
    assert res["status"] == "insufficient_data"
    assert res["next_month_forecast"] == 0

def test_get_user_daily_spending_dates(db_session):
    user = User(email="forecast2@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # Create 3 transactions on different days
    for i in range(3):
        t = Transaction(
            account_id=account.id,
            amount=100.0,
            merchant="Store",
            transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    df = get_user_daily_spending(str(user.id), db_session)
    assert len(df) == 3

def test_forecast_only_considers_debits(db_session):
    user = User(email="forecast3@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # 5 debits, 5 credits
    for i in range(5):
        t_d = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        t_c = Transaction(
            account_id=account.id, amount=500.0, merchant="Salary", transaction_type="CREDIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t_d)
        db_session.add(t_c)
    db_session.commit()

    df = get_user_daily_spending(str(user.id), db_session)
    # y column should represent debit amounts only (100.0)
    assert (df["y"] == 100.0).all()

def test_forecast_excludes_credits(db_session):
    user = User(email="forecast4@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # 15 credits only
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="CREDIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    df = get_user_daily_spending(str(user.id), db_session)
    assert len(df) == 0

@patch("prophet.Prophet", side_effect=ImportError)
def test_forecast_moving_average_fallback(mock_prophet, db_session):
    user = User(email="forecast5@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # 15 days of transactions (enough for SMA fallback)
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    res = forecast_expenses(str(user.id), db_session, periods=30)
    assert res["status"] == "success"
    assert res["model"] == "MovingAverage + LSTM"
    assert res["next_month_forecast"] == 3000.0

@patch("prophet.Prophet")
def test_forecast_with_prophet_mocked_success(mock_prophet_cls, db_session):
    user = User(email="forecast6@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # 15 days of transactions
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    mock_model = MagicMock()
    mock_prophet_cls.return_value = mock_model
    
    # Mock prediction output dataframe
    future_ds = [datetime.utcnow() + timedelta(days=i) for i in range(1, 31)]
    mock_forecast = pd.DataFrame({
        "ds": future_ds,
        "yhat": [120.0] * 30,
        "yhat_lower": [100.0] * 30,
        "yhat_upper": [140.0] * 30
    })
    mock_model.predict.return_value = mock_forecast

    res = forecast_expenses(str(user.id), db_session, periods=30)
    assert res["status"] == "success"
    assert res["model"] == "Prophet + LSTM"
    assert res["next_month_forecast"] == 3600.0

def test_forecast_cleans_old_forecasts(db_session):
    user = User(email="forecast7@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    
    # Pre-add an old forecast
    f_old = Forecast(user_id=user.id, date=datetime.utcnow(), predicted_amount=500.0)
    db_session.add(f_old)
    db_session.commit()

    # Triggering forecast_expenses cleans old forecasts
    forecast_expenses(str(user.id), db_session)
    count = db_session.query(Forecast).filter(Forecast.user_id == user.id).count()
    assert count == 0

def test_forecast_negative_prediction_bounded_to_zero(db_session):
    # If moving average is negative, it should bound to 0
    user = User(email="forecast_neg@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    with patch("app.ai.forecaster.get_user_daily_spending") as mock_spending:
        df = pd.DataFrame({
            "ds": [datetime.utcnow() - timedelta(days=i) for i in range(15)],
            "y": [-500.0] * 15
        })
        mock_spending.return_value = df
        
        # Will trigger MovingAverage fallback since prophet is either unmocked or we trigger SMA
        with patch("prophet.Prophet", side_effect=ImportError):
            res = forecast_expenses(str(user.id), db_session, periods=30)
            assert res["next_month_forecast"] == 0.0
            assert res["daily_forecast"][0]["predicted"] == 0.0

def test_forecast_saves_correct_number_of_days_in_db(db_session):
    user = User(email="forecast8@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    with patch("prophet.Prophet", side_effect=ImportError):
        forecast_expenses(str(user.id), db_session, periods=15)
        count = db_session.query(Forecast).filter(Forecast.user_id == user.id).count()
        assert count == 15

def test_forecast_structure_response(db_session):
    user = User(email="forecast9@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    with patch("prophet.Prophet", side_effect=ImportError):
        res = forecast_expenses(str(user.id), db_session, periods=30)
        assert "status" in res
        assert "next_month_forecast" in res
        assert "daily_avg" in res
        assert "daily_forecast" in res

def test_forecast_moving_average_correct_math(db_session):
    user = User(email="forecast10@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    # 15 days, exact amounts
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=200.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    with patch("prophet.Prophet", side_effect=ImportError):
        res = forecast_expenses(str(user.id), db_session, periods=10)
        assert res["next_month_forecast"] == 2000.0
        assert res["daily_avg"] == 200.0

def test_forecast_invalid_user(db_session):
    res = forecast_expenses(str(uuid.uuid4()), db_session)
    assert res["status"] == "insufficient_data"

def test_forecast_with_custom_period(db_session):
    user = User(email="forecast11@pfm.com", full_name="User", hashed_password="pwd")
    db_session.add(user)
    db_session.commit()
    account = Account(user_id=user.id, bank_name="Bank", account_token="tok", balance=5000.0)
    db_session.add(account)
    db_session.commit()
    
    for i in range(15):
        t = Transaction(
            account_id=account.id, amount=100.0, merchant="Store", transaction_type="DEBIT",
            timestamp=datetime.utcnow() - timedelta(days=i)
        )
        db_session.add(t)
    db_session.commit()

    with patch("prophet.Prophet", side_effect=ImportError):
        res = forecast_expenses(str(user.id), db_session, periods=45)
        assert len(res["daily_forecast"]) == 45
