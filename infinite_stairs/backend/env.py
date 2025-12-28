import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random

class InfiniteStairsEnv(gym.Env):
    """
    Custom Environment that follows gym interface.
    The goal is to climb stairs as fast as possible without making a mistake.
    """
    metadata = {'render.modes': ['console']}

    def __init__(self):
        super(InfiniteStairsEnv, self).__init__()
        
        # Action space: 0 (Left), 1 (Right)
        self.action_space = spaces.Discrete(2)
        
        # Observation space: Next 5 steps directions (0 or 1)
        self.observation_space = spaces.Box(low=0, high=1, shape=(5,), dtype=np.int32)
        
        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.score = 0
        self.steps_left = 500 # Episode max duration
        
        # Determine pattern: 
        # 0 = Left (x-1, y+1)
        # 1 = Right (x+1, y+1)
        # We only care about the sequence of moves required.
        # Let's verify logic:
        # If I am at stair[i], and stair[i+1] is to the Right, I must press Right (1).
        # We generate a sequence of Required Actions.
        
        self.required_moves = [random.randint(0, 1) for _ in range(1000)]
        self.current_idx = 0
        
        return self._get_obs(), {}

    def _get_obs(self):
        # Return next 5 moves required
        view = self.required_moves[self.current_idx : self.current_idx + 5]
        # Pad if near end (unlikely with 1000 buffer but good practice)
        while len(view) < 5:
            view.append(0)
        return np.array(view, dtype=np.int32)

    def step(self, action):
        target = self.required_moves[self.current_idx]
        
        terminated = False
        truncated = False
        reward = 0
        
        if action == target:
            # Correct
            self.score += 1
            self.current_idx += 1
            reward = 1.0 # Reward for climbing
            
            # Small speed incentive? 
            # In time-based games, surviving is good.
            
        else:
            # Wrong
            terminated = True
            reward = -10.0 # Penalty for dying
        
        self.steps_left -= 1
        if self.steps_left <= 0:
            truncated = True
            
        return self._get_obs(), reward, terminated, truncated, {"score": self.score}

    def render(self, mode='console'):
        pass

    def close(self):
        pass
