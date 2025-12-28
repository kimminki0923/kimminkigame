import onnx
import os

# Define paths relative to script execution location (assumed root)
input_path = os.path.join("frontend", "model_fixed.onnx")
output_path = os.path.join("frontend", "model_final.onnx")

if not os.path.exists(input_path):
    print(f"Error: {input_path} not found.")
    exit(1)

print(f"Loading {input_path}...")
# Load the model. access to external data is needed.
# Since we run this from root, and model_fixed.onnx refers to .data, 
# we need to make sure onnx can find the .data file. 
# Usually it looks in the same directory as the model file.
model = onnx.load(input_path)

print(f"Saving to {output_path}...")
# onnx.save will internalize data for small models by default
onnx.save(model, output_path)

print(f"Success! Saved to {output_path}")

# Verify file size
size = os.path.getsize(output_path)
print(f"File size: {size} bytes")
