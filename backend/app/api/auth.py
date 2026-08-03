from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.models.user import User
from app.schemas.schemas import UserCreate, UserLogin, Token, UserOut, RefreshTokenRequest

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        phone=user_data.phone,
        monthly_income=user_data.monthly_income or 0.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    user.refresh_token = refresh_token
    db.commit()
    db.refresh(user)

    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
        refresh_token=refresh_token
    )


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Streak & Points calculation
    now = datetime.utcnow()
    if not user.login_streak:
        user.login_streak = 1
        user.points = (user.points or 0) + 10
    elif user.last_login:
        last_login_date = user.last_login.date()
        today_date = now.date()
        delta_days = (today_date - last_login_date).days
        if delta_days == 1:
            user.login_streak += 1
            user.points = (user.points or 0) + 10
        elif delta_days > 1:
            user.login_streak = 1
            user.points = (user.points or 0) + 10
    else:
        user.login_streak = 1
        user.points = (user.points or 0) + 10

    user.last_login = now

    token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    user.refresh_token = refresh_token

    db.commit()
    db.refresh(user)

    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=Token)
def refresh_token_endpoint(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token using a valid refresh token."""
    token_data = decode_token(payload.refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = token_data.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.refresh_token != payload.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    new_access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    user.refresh_token = new_refresh_token

    db.commit()
    db.refresh(user)

    return Token(
        access_token=new_access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
        refresh_token=new_refresh_token
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=UserOut)
def update_profile(
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user profile."""
    allowed = ["full_name", "phone", "monthly_income"]
    for key, val in updates.items():
        if key in allowed:
            setattr(current_user, key, val)
    db.commit()
    db.refresh(current_user)
    return current_user


