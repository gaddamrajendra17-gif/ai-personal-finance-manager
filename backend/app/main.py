from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from app.core.database import engine, Base
from app.core.config import settings

# Import all models to register with SQLAlchemy
from app.models import user, finance  # noqa

# Import routers
from app.api import auth, transactions, webhooks, alerts, dashboard, accounts, recurring, plaid, robo_advisor, investments, trading, financial_advisor, savings_strategies, security, ocr, groups, realtime_agent
from app.api.predictions import router as predictions_router
from app.api.budgets import router as budgets_router, goals_router
from app.api.ai_routes import forecast_router, chat_router
from app.api.websocket import router as ws_router
from app.api.gamification import router as gamification_router
from app.api.notifications_api import router as notifications_router
from app.api.sms_receiver import router as sms_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables
    Base.metadata.create_all(bind=engine)
    print("[Success] Database tables created")

    # Seed demo user
    from app.core.database import SessionLocal
    from app.models.user import User
    from app.core.security import get_password_hash
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "demo@pfm.com").first():
            demo = User(
                email="demo@pfm.com",
                full_name="Demo User",
                hashed_password=get_password_hash("Demo@1234"),
                monthly_income=75000.0,
                is_active=True,
            )
            db.add(demo)
            db.commit()
            print("[Success] Demo user created: demo@pfm.com / Demo@1234")
    finally:
        db.close()

    # Start recurring transactions scheduler in background
    import asyncio
    from app.core.celery_app import check_and_send_reminders_task, check_and_run_recurring_task
    from app.services.simulation_service import run_simulation_tick

    async def recurring_scheduler():
        while True:
            try:
                # Trigger Celery tasks asynchronously (uses worker if active, falls back to direct call)
                check_and_run_recurring_task.delay()
                check_and_send_reminders_task.delay()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in recurring scheduler: {e}")
            await asyncio.sleep(60)

    async def simulation_scheduler():
        while True:
            try:
                await run_simulation_tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in transaction simulation scheduler: {e}")
            await asyncio.sleep(60)

    scheduler_task = asyncio.create_task(recurring_scheduler())
    sim_scheduler_task = asyncio.create_task(simulation_scheduler())

    yield

    # Shutdown: cancel tasks
    scheduler_task.cancel()
    sim_scheduler_task.cancel()
    try:
        await asyncio.gather(scheduler_task, sim_scheduler_task, return_exceptions=True)
    except Exception:
        pass
    print("[Info] Shutting down...")


app = FastAPI(
    title="AI Personal Finance Manager",
    description="Full-stack AI-powered PFM with ML categorization, forecasting, and chatbot",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(predictions_router)
app.include_router(transactions.router)
app.include_router(budgets_router)
app.include_router(goals_router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(webhooks.router)
app.include_router(forecast_router)
app.include_router(chat_router)
app.include_router(ws_router)
app.include_router(gamification_router)
app.include_router(notifications_router)
app.include_router(sms_router)
app.include_router(recurring.router)
app.include_router(plaid.router)
app.include_router(robo_advisor.router)
app.include_router(investments.router)
app.include_router(trading.router)
app.include_router(financial_advisor.router)
app.include_router(savings_strategies.router)
app.include_router(security.router)
app.include_router(ocr.router)
app.include_router(groups.router)
app.include_router(realtime_agent.router)


@app.get("/")
def root():
    return {
        "app": "AI Personal Finance Manager",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
