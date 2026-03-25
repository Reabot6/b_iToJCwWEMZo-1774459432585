#!/bin/bash

# Setup Python environment for DP generator
cd /vercel/share/v0-project

# Initialize uv project if pyproject.toml doesn't exist
if [ ! -f pyproject.toml ]; then
  echo "Initializing Python project..."
  uv init --bare scripts/python-env
fi

# Install required packages
echo "Installing Python dependencies..."
uv add rembg pillow

echo "Python environment setup complete!"
