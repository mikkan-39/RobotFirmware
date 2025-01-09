cmake_minimum_required(VERSION 3.10)
project(cpp-hardware-control)

set(CMAKE_CXX_STANDARD 17)

add_executable(cpp-hardware-control src/main.cpp
src/SCServo/SCSerial.cpp 
src/SCServo/SComms.cpp
src/SCServo/SCS.cpp
src/SCServo/STS.cpp
src/Utils/Utils.cpp
)

target_include_directories(cpp-hardware-control PRIVATE ${CMAKE_CURRENT_LIST_DIR})

find_library(WIRINGPI_LIB wiringPi REQUIRED)
target_link_libraries(${PROJECT_NAME} ${WIRINGPI_LIB})

# Optionally link libraries
# target_link_libraries(cpp-hardware-control some_library)