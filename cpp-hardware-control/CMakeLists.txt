cmake_minimum_required(VERSION 3.10)
project(HardwareControl)

set(CMAKE_CXX_STANDARD 17)

add_executable(cpp-hardware-control src/main.cpp 
src/SCServo/SCSerial.cpp 
src/SCServo/SCS.cpp
src/SCServo/SCSCL.cpp
src/SCServo/SMS_STS.cpp
)

find_library(WIRINGPI_LIB wiringPi REQUIRED)
target_link_libraries(${PROJECT_NAME} ${WIRINGPI_LIB})

# Optionally link libraries
# target_link_libraries(cpp-hardware-control some_library)