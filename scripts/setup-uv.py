#!/usr/bin/env python3
import subprocess
import sys

print("[v0] Setting up uv environment with dependencies...")

try:
    # Use uv to sync dependencies from pyproject.toml
    result = subprocess.run(
        ["uv", "sync"],
        cwd="/vercel/share/v0-project",
        capture_output=True,
        text=True
    )
    
    print("[v0] STDOUT:", result.stdout)
    print("[v0] STDERR:", result.stderr)
    print("[v0] Return code:", result.returncode)
    
    if result.returncode == 0:
        print("[v0] uv environment synced successfully!")
    else:
        print("[v0] uv sync had issues, but continuing...")
        
except Exception as e:
    print(f"[v0] Error during uv setup: {e}")
    sys.exit(1)
