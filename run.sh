#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Set up the directories for your C++ build and Node.js
# CPP_DIR="$SCRIPT_DIR/cpp-hardware-control"
# BUILD_DIR="$SCRIPT_DIR/cpp-hardware-control/build"
NODE_DIR="$SCRIPT_DIR/nodejs-main-process"

# # Create a build directory (if it doesn't exist)
# mkdir -p $BUILD_DIR

# # Change to C++ directory and run cmake and make
# echo "Building C++ code with CMake..."
# cd $CPP_DIR

# # Run cmake to generate the build system
# cmake -S . -B $BUILD_DIR

# # Run make to compile the code
# make -C $BUILD_DIR

# # Check if C++ build was successful
# if [ $? -ne 0 ]; then
#   echo "C++ build failed. Exiting..."
#   exit 1
# fi

# Check if any process is using /dev/hailo0
PROCESS_INFO=$(sudo lsof /dev/hailo0 | awk 'NR==2 {print $1, $2}')

if [ -n "$PROCESS_INFO" ]; then
  # Extract the PID from the process info
  PID=$(echo $PROCESS_INFO | awk '{print $2}')
  echo "Killing process $PROCESS_INFO"
  sudo kill "$PID"
fi

# Change to Node.js directory and run yarn start
echo "Starting Node.js application..."
cd $NODE_DIR  # This ensures we're in the correct directory for Node.js

# Find and kill previous nohup processes if any
echo "Checking for previous nohup processes..."
previous_pid=$(pgrep -f "yarn start")  # Find the process ID of the previous nohup process

if [ -n "$previous_pid" ]; then
  echo "Killing previous nohup process with PID $previous_pid..."
  kill "$previous_pid"  # Kill the previous process
fi

echo "" > nohup.out
# yarn start
nohup yarn start & tail -f nohup.out
