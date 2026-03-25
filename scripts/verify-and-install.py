#!/usr/bin/env python3
import subprocess
import sys

print("[v0] Verifying Python packages...")

# Try importing packages
try:
    from PIL import Image
    print("[v0] PIL (Pillow) is available")
except ImportError:
    print("[v0] PIL not found, installing Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    print("[v0] Pillow installed")

try:
    import rembg
    print("[v0] rembg is available")
except ImportError:
    print("[v0] rembg not found, installing rembg...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg", "-q"])
    print("[v0] rembg installed")

print("[v0] All packages verified!")
