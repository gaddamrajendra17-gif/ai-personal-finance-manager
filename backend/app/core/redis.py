import redis.asyncio as aioredis
import json
from typing import Optional, Any
from app.core.config import settings

redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = await aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
    return redis_client


async def cache_set(key: str, value: Any, ttl: int = 3600):
    """Set a value in Redis cache."""
    r = await get_redis()
    await r.setex(key, ttl, json.dumps(value))


async def cache_get(key: str) -> Optional[Any]:
    """Get a value from Redis cache."""
    r = await get_redis()
    data = await r.get(key)
    return json.loads(data) if data else None


async def cache_delete(key: str):
    """Delete a key from Redis."""
    r = await get_redis()
    await r.delete(key)


async def cache_delete_pattern(pattern: str):
    """Delete all keys matching a pattern."""
    r = await get_redis()
    keys = await r.keys(pattern)
    if keys:
        await r.delete(*keys)
