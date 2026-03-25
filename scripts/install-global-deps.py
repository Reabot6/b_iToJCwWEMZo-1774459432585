#!/usr/bin/env python3
import subprocess
import sys

print("[v0] Installing Python dependencies globally...")

packages = [
    "rembg[gpu]",
    "Pillow"
]

for package in packages:
    print(f"[v0] Installing {package}...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", package],
            capture_output=True,
            text=True
        )
        print(f"[v0] {package}: {result.returncode}")
        if result.returncode != 0:
            print(f"[v0] Error output: {result.stderr}")
    except Exception as e:
        print(f"[v0] Error installing {package}: {e}")

print("[v0] Installation complete!")
