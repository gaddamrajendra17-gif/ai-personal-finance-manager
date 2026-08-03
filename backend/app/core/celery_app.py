import os
import asyncio

# Attempt to load celery
try:
    from celery import Celery
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

if CELERY_AVAILABLE:
    celery_app = Celery(
        "pfm_tasks",
        broker=REDIS_URL,
        backend=REDIS_URL
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
    )
else:
    # High-fidelity mock class to prevent runtime import crashes
    class CeleryMock:
        def __init__(self, *args, **kwargs):
            pass
        def task(self, *args, **kwargs):
            def decorator(func):
                # Mock delay method to run task synchronously in-process
                func.delay = lambda *a, **kw: func(*a, **kw)
                return func
            return decorator
    celery_app = CeleryMock()


@celery_app.task(name="check_and_send_reminders_task")
def check_and_send_reminders_task():
    """
    Celery task that checks and dispatches upcoming bill reminders.
    """
    from app.services.recurring_service import check_and_send_upcoming_reminders
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            return loop.create_task(check_and_send_upcoming_reminders())
    except RuntimeError:
        pass
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(check_and_send_upcoming_reminders())
    finally:
        loop.close()


@celery_app.task(name="check_and_run_recurring_task")
def check_and_run_recurring_task():
    """
    Celery task that checks and processes due recurring transactions.
    """
    from app.services.recurring_service import check_and_run_recurring
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            return loop.create_task(check_and_run_recurring())
    except RuntimeError:
        pass
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(check_and_run_recurring())
    finally:
        loop.close()

