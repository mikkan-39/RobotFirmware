#!/bin/bash
echo "Setting up the project..."

# Exit on errors
set -e

# Initialize Node.js
echo "Setting up Node.js environment..."
cd nodejs-main-process
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
yarn install
cd ..

# Set up Python environment
echo "Setting up Python environment..."
cd python-ml-control
python3 -m venv --system-site-packages venv
source venv/bin/activate
sudo apt update
sudo apt install -y libcap-dev libcamera-dev libcamera-apps
pip install -r requirements.txt
deactivate
cd ..

echo "Setup complete."