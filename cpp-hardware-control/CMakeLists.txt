cmake_minimum_required(VERSION 3.10)
project(HardwareControl)

set(CMAKE_CXX_STANDARD 17)

add_executable(cpp-hardware-control src/main.cpp)

# Optionally link libraries
# target_link_libraries(cpp-hardware-control some_library)