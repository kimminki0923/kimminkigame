import os
import time
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from env import InfiniteStairsEnv

# Directory setup
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def train():
    print("Starting Training...")
    
    # Vectorized environment for faster training
    env = make_vec_env(InfiniteStairsEnv, n_envs=4)
    
    # Instantiate the agent
    model = PPO("MlpPolicy", env, verbose=1, learning_rate=0.0003)
    
    # Train the agent
    # Reduced to 20,000 steps for quick demo (enough for simple stairs)
    model.learn(total_timesteps=20000)
    
    # Save the agent
    save_path = os.path.join(MODEL_DIR, "ppo_stairs")
    model.save(save_path)
    print(f"Model saved to {save_path}")
    
    # Test
    obs = env.reset()
    for i in range(10):
        action, _states = model.predict(obs, deterministic=True)
        obs, rewards, dones, info = env.step(action)
        # print(f"Step {i}: Reward {rewards}")

if __name__ == "__main__":
    train()
