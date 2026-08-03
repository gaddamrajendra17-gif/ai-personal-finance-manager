"""
ML Expense Predictor using scikit-learn Linear Regression
Predicts next month expenses per category
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.finance import Transaction, Account

def get_monthly_spending_by_category(user_id, db: Session) -> pd.DataFrame:
    account_ids = [a.id for a in db.query(Account).filter(Account.user_id == user_id).all()]
    since = datetime.utcnow() - timedelta(days=365)
    results = db.query(
        func.date_trunc('month', Transaction.timestamp).label("month"),
        Transaction.category,
        func.sum(Transaction.amount).label("amount")
    ).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT",
        Transaction.timestamp >= since
    ).group_by(func.date_trunc('month', Transaction.timestamp), Transaction.category).all()
    if not results:
        return pd.DataFrame()
    rows = [{"month": r.month, "category": r.category or "Others", "amount": float(r.amount)} for r in results]
    return pd.DataFrame(rows)

def predict_next_month(user_id, db: Session) -> Dict:
    from sklearn.linear_model import LinearRegression
    df = get_monthly_spending_by_category(user_id, db)
    if df.empty:
        return {"status": "insufficient_data", "message": "No transaction history found", "predictions": [], "total_predicted": 0}

    categories = df["category"].unique()
    predictions = []
    total_predicted = 0

    for cat in categories:
        cat_df = df[df["category"] == cat].sort_values("month").reset_index(drop=True)
        if len(cat_df) < 2:
            avg = cat_df["amount"].mean()
            predictions.append({
                "category": cat,
                "predicted": round(avg, 0),
                "trend": "stable",
                "confidence": 60,
                "last_month": round(cat_df["amount"].iloc[-1], 0),
                "avg_monthly": round(avg, 0),
                "months_data": len(cat_df)
            })
            total_predicted += avg
            continue

        X = np.array(range(len(cat_df))).reshape(-1, 1)
        y = cat_df["amount"].values
        model = LinearRegression()
        model.fit(X, y)
        next_x = np.array([[len(cat_df)]])
        predicted = max(0, float(model.predict(next_x)[0]))
        slope = model.coef_[0]
        if slope > cat_df["amount"].mean() * 0.05:
            trend = "increasing"
        elif slope < -cat_df["amount"].mean() * 0.05:
            trend = "decreasing"
        else:
            trend = "stable"
        from sklearn.metrics import r2_score
        y_pred = model.predict(X)
        r2 = max(0, r2_score(y, y_pred))
        confidence = min(95, int(50 + r2 * 45))
        predictions.append({
            "category": cat,
            "predicted": round(predicted, 0),
            "trend": trend,
            "confidence": confidence,
            "last_month": round(float(cat_df["amount"].iloc[-1]), 0),
            "avg_monthly": round(float(cat_df["amount"].mean()), 0),
            "months_data": len(cat_df),
            "slope": round(float(slope), 2)
        })
        total_predicted += predicted

    predictions.sort(key=lambda x: x["predicted"], reverse=True)
    current_month_total = df[df["month"] == df["month"].max()]["amount"].sum()
    prev_month = df.groupby("month")["amount"].sum().sort_index()
    monthly_totals = list(prev_month.values)

    return {
        "status": "success",
        "predictions": predictions,
        "total_predicted": round(total_predicted, 0),
        "current_month_total": round(float(current_month_total), 0),
        "monthly_totals": [round(float(x), 0) for x in monthly_totals[-6:]],
        "model": "LinearRegression",
        "categories_count": len(predictions)
    }

