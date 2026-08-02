import os
import sys

# Override DATABASE_URL for testing BEFORE importing the main app or any core configs
os.environ["DATABASE_URL"] = "postgresql://pfm_user:pfm_password@127.0.0.1:5432/pfm_test"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import ProgrammingError
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.core.security import get_password_hash

# Define test database URLs
ADMIN_DATABASE_URL = "postgresql://postgres:@127.0.0.1:5432/postgres"
TEST_DATABASE_URL = "postgresql://pfm_user:pfm_password@127.0.0.1:5432/pfm_test"

# Automatically create the test database if it doesn't exist
try:
    admin_engine = create_engine(ADMIN_DATABASE_URL, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        # Check if database exists by querying pg_database
        result = conn.execute("SELECT 1 FROM pg_database WHERE datname='pfm_test'").first()
        if not result:
            conn.execute("CREATE DATABASE pfm_test")
            print("\n[OK] Created test database 'pfm_test'")
    admin_engine.dispose()
except Exception as e:
    print(f"\n[WARNING] Could not automatically create 'pfm_test' database: {e}")
    print("Will attempt to connect anyway...")

# Create test engine and session factory
engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create all tables at the start of testing and drop them at the end."""
    # Drop existing tables to clear any dirty state from crashed runs
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()

@pytest.fixture
def db_session():
    """Provide a transactional database session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    """Provide a TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers(client, db_session):
    """Create a default test user and login to return authentication headers."""
    from app.models.user import User
    
    test_email = "testuser@pfm.com"
    test_password = "TestPassword123!"
    
    # Check if user already exists in db (to prevent uniqueness constraint failure)
    user = db_session.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            email=test_email,
            full_name="Test User",
            hashed_password=get_password_hash(test_password),
            phone="+1234567890",
            monthly_income=50000.0,
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    
    # Login to get authorization token
    response = client.post(
        "/api/auth/login",
        data={"username": test_email, "password": test_password}
    )
    assert response.status_code == 200, f"Login failed: {response.json()}"
    token_data = response.json()
    token = token_data["access_token"]
    
    return {"Authorization": f"Bearer {token}"}
