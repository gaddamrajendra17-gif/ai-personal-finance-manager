from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import json
import asyncio
from app.core.database import SessionLocal
from app.ai.agent import run_agent

router = APIRouter(prefix="/api/realtime-agent", tags=["Real-time Voice Agent"])

# In-memory history for WebSocket sessions
_ws_session_histories = {}

@router.websocket("/ws/{user_id}")
async def realtime_agent_websocket(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint for continuous, low-latency duplex voice/text agent interactions.
    """
    await websocket.accept()
    print(f"[Real-time Agent] WebSocket connected for user: {user_id}")
    
    # Initialize history for this session
    session_key = f"{user_id}:{id(websocket)}"
    _ws_session_histories[session_key] = []
    
    try:
        await websocket.send_json({
            "type": "status",
            "status": "connected",
            "message": "Connected to real-time agent pipeline."
        })
        
        while True:
            # Wait for user inputs (voice transcripts or text logs)
            data_text = await websocket.receive_text()
            
            try:
                data = json.loads(data_text)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format received."
                })
                continue
                
            msg_type = data.get("type")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
                
            if msg_type == "user_message":
                query = data.get("message")
                system_prompt = data.get("system_prompt")
                
                if not query:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Empty query received."
                    })
                    continue
                
                # Update status to thinking
                await websocket.send_json({
                    "type": "status",
                    "status": "thinking",
                    "message": "Agent is thinking..."
                })
                
                # Fetch chat history for this specific socket connection
                history = _ws_session_histories.get(session_key, [])
                
                # Open db session
                db = SessionLocal()
                try:
                    # Run the agent with custom system prompt (if provided) and user context
                    response, thoughts, actions = await run_agent(
                        query=query,
                        user_id=user_id,
                        db=db,
                        chat_history=history,
                        system_prompt=system_prompt
                    )
                    
                    # Update local session history
                    history.append({"role": "user", "content": query})
                    history.append({"role": "assistant", "content": response})
                    _ws_session_histories[session_key] = history[-10:] # Keep last 10 messages
                    
                    # Send result back
                    await websocket.send_json({
                        "type": "agent_response",
                        "response": response,
                        "thoughts": thoughts,
                        "actions": actions
                    })
                    
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Agent runtime error: {str(e)}"
                    })
                finally:
                    db.close()
                    
                # Reset status to idle
                await websocket.send_json({
                    "type": "status",
                    "status": "idle",
                    "message": "Agent ready."
                })
                
            elif msg_type == "clear_history":
                _ws_session_histories[session_key] = []
                await websocket.send_json({
                    "type": "status",
                    "status": "idle",
                    "message": "Session history cleared."
                })
                
    except WebSocketDisconnect:
        print(f"[Real-time Agent] WebSocket disconnected for user: {user_id}")
    finally:
        _ws_session_histories.pop(session_key, None)
