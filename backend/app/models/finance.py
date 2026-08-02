import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    bank_name = Column(String, nullable=False)
    account_token = Column(String, nullable=False)  # Tokenized, never raw number
    account_last4 = Column(String(4), nullable=True)
    account_type = Column(String, default="savings")  # savings, current, credit
    balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    merchant = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)       # AI-assigned
    subcategory = Column(String, nullable=True)
    transaction_type = Column(String, nullable=False)  # DEBIT / CREDIT
    upi_ref = Column(String, nullable=True)
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, nullable=True)
    is_recurring = Column(Boolean, default=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=False)
    limit_amount = Column(Float, nullable=False)
    spent_amount = Column(Float, default=0.0)
    period = Column(String, default="monthly")  # monthly, weekly
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="budgets")


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    goal_name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    monthly_contribution = Column(Float, default=0.0)
    deadline = Column(DateTime, nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="savings_goals")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    alert_type = Column(String, nullable=False)  # ANOMALY, BUDGET_EXCEEDED, BILL_DUE
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, default="MEDIUM")  # LOW, MEDIUM, HIGH
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="alerts")


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    predicted_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    merchant = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    transaction_type = Column(String, nullable=False)  # DEBIT / CREDIT
    frequency = Column(String, nullable=False)  # daily, weekly, monthly
    next_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    last_reminder_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    account = relationship("Account")


class RoboProfile(Base):
    __tablename__ = "robo_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    age = Column(Integer, nullable=False)
    risk_tolerance = Column(String, nullable=False)  # CONSERVATIVE, MODERATE, AGGRESSIVE
    risk_score = Column(Integer, default=50)  # 1-100
    investment_horizon = Column(Integer, default=5)  # years
    monthly_investment_target = Column(Float, default=0.0)
    financial_goal = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    name = Column(String, nullable=False)
    asset_type = Column(String, nullable=False)  # STOCK, MUTUAL_FUND, GOLD, CRYPTO
    quantity = Column(Float, default=0.0)
    avg_buy_price = Column(Float, default=0.0)
    current_price = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    name = Column(String, nullable=False)
    asset_type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)  # BUY, SELL
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class TradingStrategy(Base):
    __tablename__ = "trading_strategies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    strategy_type = Column(String, nullable=False)  # SMA_CROSSOVER, MEAN_REVERSION, MOMENTUM
    capital = Column(Float, default=100000.0)
    cash = Column(Float, default=100000.0)
    is_active = Column(Boolean, default=False)
    params = Column(String, default="{}")  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class SavingsStrategy(Base):
    __tablename__ = "savings_strategies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_name = Column(String, nullable=False)
    source_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    destination_goal_id = Column(UUID(as_uuid=True), ForeignKey("savings_goals.id"), nullable=False)
    transfer_amount = Column(Float, nullable=False)
    frequency = Column(String, default="monthly")  # daily, weekly, monthly
    status = Column(String, default="ACTIVE")  # ACTIVE, PAUSED
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    source_account = relationship("Account", foreign_keys=[source_account_id])
    destination_goal = relationship("SavingsGoal", foreign_keys=[destination_goal_id])


class Group(Base):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    expenses = relationship("GroupExpense", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    name = Column(String, nullable=False)

    group = relationship("Group", back_populates="members")


class GroupExpense(Base):
    __tablename__ = "group_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    paid_by = Column(String, nullable=False)
    split_with = Column(Text, nullable=False)  # JSON serialized list of names
    date = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="expenses")
    settlements = relationship("Settlement", back_populates="expense", cascade="all, delete-orphan")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_expense_id = Column(UUID(as_uuid=True), ForeignKey("group_expenses.id"), nullable=False)
    from_member = Column(String, nullable=False)
    to_member = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    settled = Column(Boolean, default=False)

    expense = relationship("GroupExpense", back_populates="settlements")



