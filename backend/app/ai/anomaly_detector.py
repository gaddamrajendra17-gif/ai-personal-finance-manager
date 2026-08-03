"""
Fraud & Anomaly Detection
Uses Isolation Forest + statistical z-score rules.
"""
import numpy as np
from typing import Tuple
from sqlalchemy.orm import Session
from app.models.finance import Transaction, Account


def _get_user_stats(user_id: str, db: Session) -> dict:
    """Get user's historical transaction statistics."""
    account_ids = [
        a.id for a in db.query(Account).filter(Account.user_id == user_id).all()
    ]
    if not account_ids:
        return {"mean": 0, "std": 0, "count": 0, "merchants": set()}

    txns = db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids),
        Transaction.transaction_type == "DEBIT"
    ).all()

    if not txns:
        return {"mean": 0, "std": 0, "count": 0, "merchants": set()}

    amounts = [t.amount for t in txns]
    merchants = {t.merchant.lower() for t in txns}

    return {
        "mean": np.mean(amounts),
        "std": np.std(amounts) or 1,
        "count": len(amounts),
        "merchants": merchants,
        "max": max(amounts),
    }


def check_anomaly(
    user_id: str,
    amount: float,
    merchant: str,
    db: Session
) -> Tuple[bool, float]:
    """
    Check if a transaction is anomalous.
    Returns (is_anomaly, anomaly_score 0-1).
    """
    stats = _get_user_stats(user_id, db)

    # Not enough history
    if stats["count"] < 10:
        return False, 0.0

    score = 0.0
    reasons = []

    # Rule 1: Amount is > 4 standard deviations from mean
    z_score = abs(amount - stats["mean"]) / stats["std"]
    if z_score > 4:
        score += 0.5
        reasons.append(f"amount_spike_z{z_score:.1f}")

    # Rule 2: Amount is > 3x the user's max historical transaction
    if amount > stats["max"] * 3:
        score += 0.3
        reasons.append("exceeds_max_3x")

    # Rule 3: Unknown merchant (never transacted before)
    if merchant.lower() not in stats["merchants"]:
        score += 0.2
        reasons.append("unknown_merchant")

    is_anomaly = score >= 0.5
    return is_anomaly, min(score, 1.0)


def isolation_forest_check(amounts: list, new_amount: float) -> Tuple[bool, float]:
    """
    Use Isolation Forest for batch anomaly detection.
    Call this from the ML training pipeline.
    """
    if len(amounts) < 20:
        return False, 0.0

    try:
        from sklearn.ensemble import IsolationForest
        X = np.array(amounts).reshape(-1, 1)
        model = IsolationForest(contamination=0.05, random_state=42)
        model.fit(X)
        score = model.decision_function([[new_amount]])[0]
        pred = model.predict([[new_amount]])[0]
        # score < 0 means anomaly; normalize to 0-1
        normalized = max(0, min(1, (-score + 0.5)))
        return bool(pred == -1), float(normalized)
    except ImportError:
        return False, 0.0

