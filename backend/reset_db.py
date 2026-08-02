# reset_db.py
import sys
import os

# Add the current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
# Import all models to register them on Base
from app.models.user import User
from app.models.finance import Account, Transaction, Budget, SavingsGoal, Alert, Forecast
from app.services.notification_service import Notification
from app.api.gamification import Badge, UserBadge, Challenge, UserChallenge

def reset_database():
    print("Dropping all tables in development database...")
    Base.metadata.drop_all(bind=engine)
    print("[OK] All tables dropped.")
    
    print("Recreating all tables with new schema...")
    Base.metadata.create_all(bind=engine)
    print("[OK] All tables recreated successfully.")

if __name__ == "__main__":
    reset_database()
