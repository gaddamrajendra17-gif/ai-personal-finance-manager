from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ── Auth Schemas ──────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    phone: Optional[str] = None
    monthly_income: Optional[float] = 0.0


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    monthly_income: float
    is_active: bool
    login_streak: int = 0
    points: int = 0
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut
    refresh_token: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── Account Schemas ───────────────────────────────────────────
class AccountCreate(BaseModel):
    bank_name: str
    account_token: str
    account_last4: Optional[str] = None
    account_type: str = "savings"
    balance: float = 0.0


class AccountOut(BaseModel):
    id: UUID
    bank_name: str
    account_token: str
    account_last4: Optional[str]
    account_type: str
    balance: float
    is_active: bool

    class Config:
        from_attributes = True


# ── Transaction Schemas ───────────────────────────────────────
class TransactionCreate(BaseModel):
    account_id: UUID
    amount: float
    merchant: str
    description: Optional[str] = None
    transaction_type: str  # DEBIT or CREDIT
    upi_ref: Optional[str] = None
    timestamp: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TransactionOut(BaseModel):
    id: UUID
    account_id: UUID
    amount: float
    merchant: str
    description: Optional[str]
    category: Optional[str]
    subcategory: Optional[str]
    transaction_type: str
    upi_ref: Optional[str]
    is_anomaly: bool
    anomaly_score: Optional[float] = None
    is_recurring: bool
    timestamp: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def adjust_amount_sign(self) -> "TransactionOut":
        if self.transaction_type == "DEBIT" and self.amount > 0:
            self.amount = -abs(self.amount)
        elif self.transaction_type == "CREDIT" and self.amount < 0:
            self.amount = abs(self.amount)
        return self


class WebhookTransaction(BaseModel):
    """Payload received from bank webhook."""
    txn_id: str
    amount: float
    merchant: str
    timestamp: str
    account_token: str
    type: str  # DEBIT / CREDIT
    upi_ref: Optional[str] = None
    description: Optional[str] = None


# ── Budget Schemas ────────────────────────────────────────────
class BudgetCreate(BaseModel):
    category: str
    limit_amount: float
    period: str = "monthly"


class BudgetOut(BaseModel):
    id: UUID
    category: str
    limit_amount: float
    spent_amount: float
    period: str
    month: int
    year: int

    class Config:
        from_attributes = True


# ── Savings Goal Schemas ──────────────────────────────────────
class SavingsGoalCreate(BaseModel):
    goal_name: str
    target_amount: float
    monthly_contribution: float = 0.0
    deadline: Optional[datetime] = None


class SavingsGoalOut(BaseModel):
    id: UUID
    goal_name: str
    target_amount: float
    current_amount: float
    monthly_contribution: float
    deadline: Optional[datetime]
    is_completed: bool
    progress_percent: Optional[float] = None

    class Config:
        from_attributes = True


# ── Alert Schemas ─────────────────────────────────────────────
class AlertOut(BaseModel):
    id: UUID
    alert_type: str
    title: str
    message: str
    severity: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard Schema ──────────────────────────────────────────
class DashboardData(BaseModel):
    total_balance: float
    monthly_income: float
    monthly_spent: float
    monthly_savings: float
    top_categories: List[dict]
    spending_trend: List[dict]
    budget_status: List[dict]
    recent_transactions: List[TransactionOut]
    unread_alerts: int


# ── Chatbot Schema ────────────────────────────────────────────
class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    suggestions: Optional[List[str]] = None
    relevant_transactions: Optional[List[TransactionOut]] = None
    thoughts: Optional[str] = None
    actions: Optional[List[dict]] = None


# ── Scenario Simulation ───────────────────────────────────────
class ScenarioInput(BaseModel):
    current_savings: float
    monthly_extra: float
    goal: float


# ── Recurring Transaction Schemas ──────────────────────────────
class RecurringTransactionCreate(BaseModel):
    account_id: UUID
    amount: float
    merchant: str
    category: str
    transaction_type: str  # DEBIT or CREDIT
    frequency: str  # daily, weekly, monthly
    next_date: datetime


class RecurringTransactionOut(BaseModel):
    id: UUID
    account_id: UUID
    merchant: str
    amount: float
    category: str
    transaction_type: str
    frequency: str
    next_date: datetime
    is_active: bool
    last_reminder_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

