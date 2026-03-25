#!/usr/bin/env python3
"""Install Python dependencies for DP generator"""

import subprocess
import sys

# Install required packages
packages = [
    "rembg[gpu]",  # Background removal with GPU support
    "Pillow",      # Image processing
]

print("[v0] Installing Python dependencies...")
for package in packages:
    print(f"[v0] Installing {package}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", package])

print("[v0] Dependencies installed successfully!")
