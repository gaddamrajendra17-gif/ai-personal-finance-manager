"""
WebSocket endpoint for real-time notifications.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
import json
import asyncio

router = APIRouter(tags=["WebSocket"])

# Connection manager
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active:
            self.active[user_id] = []
        self.active[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active:
            self.active[user_id].discard(websocket) if isinstance(
                self.active[user_id], set) else None
            try:
                self.active[user_id].remove(websocket)
            except ValueError:
                pass

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active:
            dead = []
            for ws in self.active[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(user_id, ws)

    async def broadcast(self, message: dict):
        for user_id in self.active:
            await self.send_to_user(user_id, message)


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    WebSocket connection for real-time alerts.
    Connect from frontend: new WebSocket('ws://localhost:8000/ws/{userId}')
    """
    await manager.connect(user_id, websocket)
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Real-time alerts active"
        })
        while True:
            # Keep connection alive, receive pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)


async def notify_user(user_id: str, event_type: str, data: dict):
    """Send a real-time notification to a specific user."""
    await manager.send_to_user(user_id, {
        "type": event_type,
        "data": data
    })

