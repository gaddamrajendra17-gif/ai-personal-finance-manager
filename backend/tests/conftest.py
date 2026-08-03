import os
import sys

import os
import sys

db_url = os.environ.get("DATABASE_URL", "postgresql://pfm_user:pfm_password@127.0.0.1:5432/pfm_test")
os.environ["DATABASE_URL"] = db_url

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    engine = create_engine(db_url, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash


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

