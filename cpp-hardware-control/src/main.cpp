#include <errno.h>
#include <string.h>

#include <csignal>
#include <cstdlib>
#include <iostream>
#include <iterator>
#include <string>

#include "SCServo/SCServo.h"
#include "Utils/Utils.h"

STS STServo;
const char* serialPath = "/dev/ttyAMA4";

#define NUM_SERVOS 22

void cleanupAndExit(int signal) {
  std::cout << "\nReceived termination signal " << signal
            << ", performing shutdown..." << std::endl;
  std::cout << "Disabling Servos Torque...\n";
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    STServo.EnableTorque(id, false);
  }

  std::exit(signal);
}

int main() {
  std::cout << "INIT: C++ subsystem started." << std::endl;

  if (STServo.openSerial(serialPath) == -1) {
    std::cout << "FATAL: Failed to open servo serial port. Exiting."
              << std::endl;
    return 0;
  }

  if (wiringPiSetup() == -1) {
    std::cout << "FATAL: Unable to start wiringPi: %s\n"
              << strerror(errno) << std::endl;
    return 1;
  }

  std::signal(SIGINT, cleanupAndExit);   // Handle Ctrl+C
  std::signal(SIGTERM, cleanupAndExit);  // Handle termination signal

  std::string command;
  while (true) {
    std::getline(std::cin, command);  // Read command from stdin

    if (command.empty()) {
      continue;  // Skip this iteration and wait for a new command
    }

    if (command == "PING") {
      handlePing(STServo, NUM_SERVOS);
    } else if (command == "SERVOS_QUERY_POSITIONS") {
      handleQueryServoPositions(STServo, NUM_SERVOS);
    } else if (command == "SERVOS_QUERY_MOVING") {
      handleQueryServoMoving(STServo, NUM_SERVOS);
    } else if (command == "SERVOS_QUERY_SPEED") {
      handleQueryServoSpeed(STServo, NUM_SERVOS);
    } else if (command.rfind("SET_SERVO_POS", 0) == 0) {
      handleSetServoPositions(STServo, command);
    } else if (command.rfind("SET_SERVO_SPEED", 0) == 0) {
      handleSetServoSpeeds(STServo, command);
    } else if (command.rfind("SET_SERVO_TORQUE", 0) == 0) {
      handleSetServoTorque(STServo, command);
    } else if (command.rfind("SET_SERVO_ENABLED", 0) == 0) {
      handleSetServoEnabled(STServo, command);
    } else if (command == "EXIT") {
      std::cout << "EXIT: Exiting C++..." << std::endl;
      cleanupAndExit(0);
      break;
    } else {
      std::cout << "ERROR: Unknown command to C++: " << command << std::endl;
    }
  }

  return 0;
}