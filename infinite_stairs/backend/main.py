import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
import asyncio
import os
import sys

# Add current dir to path for imports if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI()

# Mount Frontend
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/style.css")
async def read_css():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"))

@app.get("/script.js")
async def read_js():
    return FileResponse(os.path.join(FRONTEND_DIR, "script.js"))

@app.get("/model.onnx")
async def read_onnx():
    return FileResponse(os.path.join(FRONTEND_DIR, "model.onnx"))

@app.get("/model.onnx.data")
async def read_onnx_data():
    return FileResponse(os.path.join(FRONTEND_DIR, "model.onnx.data"))

# RL Model Loading (Placeholder or Actual)
# For real time inference, we would load the PPO model here.
# from stable_baselines3 import PPO
model = None
try:
    from stable_baselines3 import PPO
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "ppo_stairs.zip")
    if os.path.exists(model_path):
        model = PPO.load(model_path)
        print("RL Model Loaded!")
    else:
        print("No RL Model found. AI will be random/heuristic.")
except ImportError:
    print("Stable-Baselines3 not installed. Install via: pip install stable-baselines3 shimmy gymnasium")

@app.websocket("/ws/game")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            state = json.loads(data)
            
            # Protocol:
            # Client sends: {event: "state", obs: [0, 1, ...], score: 10, ai_active: true}
            # Server responds: {action: 0 or 1}
            
            if state.get("event") == "state" and state.get("ai_active"):
                obs = state["obs"]
                player_dir = state.get("playerDir", 1) # Default to Right if missing
                
                # 1. Get Intended Absolute Direction
                # 0 = Left, 1 = Right
                intended_dir = 0
                
                if model:
                    # Model inference
                    action, _ = model.predict(obs, deterministic=True)
                    intended_dir = int(action)
                else:
                    # Heuristic
                    # obs[0] is the direction of the NEXT stair.
                    if len(obs) > 0:
                        intended_dir = obs[0]
                
                # 2. Convert to Game Action (Relative)
                # Frontend expects: 0 = Forward (Keep Dir), 1 = Turn (Flip Dir)
                
                final_action = 0
                if intended_dir == player_dir:
                    final_action = 0 # Forward
                else:
                    final_action = 1 # Turn
                
                # Send action back
                # Add a small delay to simulate human/speed limit? No, infinite stairs is fast.
                await asyncio.sleep(0.05) # 20 actions per sec limit
                await websocket.send_text(json.dumps({"action": final_action}))
                
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
