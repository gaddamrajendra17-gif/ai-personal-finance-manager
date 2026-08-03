import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from fastapi import WebSocket, WebSocketDisconnect
from app.api.websocket import ConnectionManager as WSConnectionManager, manager as ws_manager, notify_user as ws_notify_user
from app.api.notifications_api import ConnectionManager as NotifConnectionManager, manager as notif_manager

# 1. Test WebSocket ConnectionManager connect adds user and websocket to active dictionary
@pytest.mark.asyncio
async def test_ws_manager_connect():
    test_manager = WSConnectionManager()
    mock_ws = AsyncMock(spec=WebSocket)
    await test_manager.connect("user_123", mock_ws)
    
    assert "user_123" in test_manager.active
    assert mock_ws in test_manager.active["user_123"]
    mock_ws.accept.assert_called_once()

# 2. Test WebSocket ConnectionManager disconnect removes websocket
@pytest.mark.asyncio
async def test_ws_manager_disconnect():
    test_manager = WSConnectionManager()
    mock_ws = AsyncMock(spec=WebSocket)
    await test_manager.connect("user_123", mock_ws)
    
    test_manager.disconnect("user_123", mock_ws)
    assert mock_ws not in test_manager.active["user_123"]

# 3. Test WebSocket ConnectionManager disconnect on non-existent user/socket doesn't raise exception
def test_ws_manager_disconnect_non_existent():
    test_manager = WSConnectionManager()
    mock_ws = MagicMock(spec=WebSocket)
    # Should not raise exception
    test_manager.disconnect("non_existent", mock_ws)

# 4. Test WebSocket send_to_user sends json to all user's websockets
@pytest.mark.asyncio
async def test_ws_manager_send_to_user_active():
    test_manager = WSConnectionManager()
    mock_ws1 = AsyncMock(spec=WebSocket)
    mock_ws2 = AsyncMock(spec=WebSocket)
    await test_manager.connect("user_123", mock_ws1)
    await test_manager.connect("user_123", mock_ws2)
    
    msg = {"hello": "world"}
    await test_manager.send_to_user("user_123", msg)
    
    mock_ws1.send_json.assert_called_with(msg)
    mock_ws2.send_json.assert_called_with(msg)

# 5. Test WebSocket send_to_user on user with no active connections does not fail
@pytest.mark.asyncio
async def test_ws_manager_send_to_user_no_active():
    test_manager = WSConnectionManager()
    # Should do nothing and not fail
    await test_manager.send_to_user("no_active_user", {"msg": "test"})

# 6. Test WebSocket send_to_user removes dead websocket when send_json raises exception
@pytest.mark.asyncio
async def test_ws_manager_send_to_user_error_cleanup():
    test_manager = WSConnectionManager()
    mock_ws_good = AsyncMock(spec=WebSocket)
    mock_ws_bad = AsyncMock(spec=WebSocket)
    mock_ws_bad.send_json.side_effect = Exception("Connection closed")
    
    await test_manager.connect("user_123", mock_ws_good)
    await test_manager.connect("user_123", mock_ws_bad)
    
    await test_manager.send_to_user("user_123", {"msg": "ping"})
    
    # bad websocket should have been disconnected/removed
    assert mock_ws_bad not in test_manager.active["user_123"]
    assert mock_ws_good in test_manager.active["user_123"]

# 7. Test WebSocket broadcast sends messages to all active users
@pytest.mark.asyncio
async def test_ws_manager_broadcast():
    test_manager = WSConnectionManager()
    mock_ws1 = AsyncMock(spec=WebSocket)
    mock_ws2 = AsyncMock(spec=WebSocket)
    
    await test_manager.connect("user_a", mock_ws1)
    await test_manager.connect("user_b", mock_ws2)
    
    msg = {"broadcast": "data"}
    await test_manager.broadcast(msg)
    
    mock_ws1.send_json.assert_called_with(msg)
    mock_ws2.send_json.assert_called_with(msg)

# 8. Test WS notify_user helper calls send_to_user with correct format
@pytest.mark.asyncio
async def test_ws_notify_user(monkeypatch):
    sent_messages = []
    
    async def mock_send_to_user(user_id: str, message: dict):
        sent_messages.append((user_id, message))
        
    monkeypatch.setattr(ws_manager, "send_to_user", mock_send_to_user)
    
    await ws_notify_user("user_xyz", "my_event", {"val": 123})
    assert len(sent_messages) == 1
    assert sent_messages[0] == ("user_xyz", {"type": "my_event", "data": {"val": 123}})

# 9. Test WebSocket endpoint lifecycle: connection and initial greeting using TestClient
def test_ws_endpoint_lifecycle(client):
    with client.websocket_connect("/ws/user_test_lifecycle") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["message"] == "Real-time alerts active"

# 10. Test WebSocket endpoint ping-pong keeps connection alive
def test_ws_endpoint_ping_pong(client):
    with client.websocket_connect("/ws/user_test_ping") as websocket:
        # consume greeting
        websocket.receive_json()
        
        # send ping
        websocket.send_text("ping")
        resp = websocket.receive_text()
        assert resp == "pong"

# 11. Test Notifications ConnectionManager connect and disconnect
@pytest.mark.asyncio
async def test_notifications_manager_connect_disconnect():
    test_manager = NotifConnectionManager()
    mock_ws = AsyncMock(spec=WebSocket)
    
    # Connect
    await test_manager.connect(mock_ws, "user_notif_1")
    assert "user_notif_1" in test_manager.active_connections
    mock_ws.accept.assert_called_once()
    
    # Send
    await test_manager.send_to_user("user_notif_1", {"msg": "hello"})
    mock_ws.send_json.assert_called_with({"msg": "hello"})
    
    # Disconnect
    test_manager.disconnect("user_notif_1")
    assert "user_notif_1" not in test_manager.active_connections

# 12. Test Notifications WebSocket endpoint lifecycle
def test_notifications_endpoint_lifecycle(client):
    with client.websocket_connect("/api/notifications/ws/user_notif_lifecycle") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["message"] == "Connected"

