
import torch
import torch.nn as nn
from stable_baselines3 import PPO
import os

# Define paths
model_path = os.path.join("models", "ppo_stairs.zip")
# Save directly to frontend
output_path = os.path.join("frontend", "model_fixed.onnx")

print(f"Loading model from {model_path}...")
model = PPO.load(model_path)

class OnnxablePolicy(nn.Module):
    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation):
        features = self.policy.extract_features(observation)
        latent_pi, _ = self.policy.mlp_extractor(features)
        action_logits = self.policy.action_net(latent_pi)
        return action_logits

onnx_policy = OnnxablePolicy(model.policy)
dummy_input = torch.randn(1, 5)

print(f"Exporting to {output_path}...")

# Export with simple settings, ensuring no external data split (it shouldn't for small models anyway)
# We use opset 12 which is very standard for web

# Remove existing data file if it exists to avoid confusion
data_path = output_path + ".data"
if os.path.exists(data_path):
    os.remove(data_path)

torch.onnx.export(
    onnx_policy,
    dummy_input,
    output_path,
    opset_version=12,
    input_names=["input"],
    output_names=["output"],
    do_constant_folding=True,
    export_params=True
)

print("Export complete!")
