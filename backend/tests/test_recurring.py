import pytest
import asyncio
from datetime import datetime, timedelta
from app.models.finance import RecurringTransaction, Transaction, Account
from app.services.recurring_service import check_and_run_recurring

def test_recurring_transaction_flow(client, auth_headers, db_session):
    # 1. Create a bank account
    acct_resp = client.post(
        "/api/accounts/",
        json={
            "bank_name": "Test Bank",
            "account_token": "token_test_123",
            "account_last4": "1111",
            "account_type": "savings",
            "balance": 10000.0
        },
        headers=auth_headers
    )
    assert acct_resp.status_code == 200
    account_id = acct_resp.json()["id"]

    # 2. Add a recurring transaction (CREDIT for salary)
    # We must set next_date to a past timestamp so it triggers immediately
    next_run = datetime.utcnow() - timedelta(minutes=5)
    rec_resp = client.post(
        "/api/recurring/",
        json={
            "account_id": account_id,
            "merchant": "Employer Corp",
            "amount": 50000.0,
            "category": "Salary",
            "transaction_type": "CREDIT",
            "frequency": "monthly",
            "next_date": next_run.isoformat()
        },
        headers=auth_headers
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["merchant"] == "Employer Corp"
    assert rec_data["amount"] == 50000.0
    assert rec_data["frequency"] == "monthly"
    recurring_id = rec_data["id"]

    # Commit any changes from client to let check_and_run_recurring see it (since it uses a separate SessionLocal)
    db_session.commit()

    # 3. Retrieve recurring transactions list
    list_resp = client.get("/api/recurring/", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["id"] == recurring_id

    # 4. Run background worker check_and_run_recurring()
    asyncio.run(check_and_run_recurring(db=db_session))

    # 5. Verify transaction was created in database and is_recurring is True
    txns_resp = client.get("/api/transactions/", headers=auth_headers)
    assert txns_resp.status_code == 200
    txns = txns_resp.json()
    assert len(txns) == 1
    assert txns[0]["amount"] == 50000.0
    assert txns[0]["merchant"] == "Employer Corp"
    assert txns[0]["transaction_type"] == "CREDIT"
    assert txns[0]["is_recurring"] is True

    # 6. Verify account balance was updated (10000 + 50000 = 60000)
    acct_resp2 = client.get("/api/accounts/", headers=auth_headers)
    target_acct = [a for a in acct_resp2.json() if a["id"] == account_id][0]
    assert target_acct["balance"] == 60000.0

    # 7. Verify next_date was pushed forward by 1 month
    rec_list = client.get("/api/recurring/", headers=auth_headers).json()
    new_next_date = datetime.fromisoformat(rec_list[0]["next_date"].replace("Z", ""))
    assert new_next_date > datetime.utcnow()

    # 8. Delete the recurring transaction schedule
    del_resp = client.delete(f"/api/recurring/{recurring_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # Verify list is empty
    list_resp2 = client.get("/api/recurring/", headers=auth_headers)
    assert len(list_resp2.json()) == 0
