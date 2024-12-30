#!/bin/bash
echo "Setting up the project..."

# Exit on errors
set -e

# Build hardware control
echo "Building hardware control..."
cd cpp-hardware-control

# Install WiringPi if necessary
if ! command -v gpio &> /dev/null
then
    echo "WiringPi not found. Installing..."
    git clone https://github.com/WiringPi/WiringPi.git
    cd WiringPi
    ./build
    cd ..
    rm -rf WiringPi
else
    echo "WiringPi is already installed."
fi

mkdir -p build && cd build
cmake ..
make
cd ../..

# Initialize Node.js
echo "Setting up Node.js environment..."
cd nodejs-main-process
yarn install
cd ..

# Set up Python environment
echo "Setting up Python environment..."
cd python-ml-control
if [ ! -f "requirements.txt" ]; then
    echo "requirements.txt not found, creating a default one..."
    echo "numpy\ntensorflow\n" > requirements.txt
fi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

echo "Setup complete."