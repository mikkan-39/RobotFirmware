#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Set up the directories for your C++ build and Node.js
CPP_DIR="$SCRIPT_DIR/cpp-hardware-control"
BUILD_DIR="$SCRIPT_DIR/cpp-hardware-control/build"
NODE_DIR="$SCRIPT_DIR/node-decision-layer"

# Create a build directory (if it doesn't exist)
mkdir -p $BUILD_DIR

# Change to C++ directory and run cmake and make
echo "Building C++ code with CMake..."
cd $CPP_DIR

# Run cmake to generate the build system
cmake -S . -B $BUILD_DIR

# Run make to compile the code
make -C $BUILD_DIR

# Check if C++ build was successful
if [ $? -ne 0 ]; then
  echo "C++ build failed. Exiting..."
  exit 1
fi

# Change to Node.js directory and run yarn start
echo "Starting Node.js application..."
cd $NODE_DIR  # This ensures we're in the correct directory for Node.js
yarn start
