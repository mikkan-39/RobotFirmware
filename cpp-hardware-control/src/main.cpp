#include <errno.h>
#include <string.h>

#include <csignal>
#include <cstdlib>
#include <iostream>
#include <string>

#include "SCServo/SCServo.h"
#include "Utils/Utils.h"

STS STServo;
const char* serialPath = "/dev/ttyAMA4";

#define NUM_SERVOS 22

void cleanupAndExit(int signal) {
  std::cout << "\nCaught signal " << signal << ", performing cleanup..."
            << std::endl;

  // Perform cleanup here (close files, release resources, etc.)
  // Example:
  std::cout << "Cleaning up resources...\n";
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    STServo.EnableTorque(id, false);
  }
  // Exit the program
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

  bool pingResponses[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    bool initialized = STServo.Ping(id) != -1;
    pingResponses[id] = initialized;
  }

  int headX = 2048;
  int headY = 2048;
  std::string command;
  while (true) {
    std::getline(std::cin, command);  // Read command from stdin

    if (command.empty()) {
      continue;  // Skip this iteration and wait for a new command
    }

    if (command == "PING") {
      printPingResponses(pingResponses, NUM_SERVOS);
    } else if (command.rfind("HEAD_ROTATE", 0) == 0) {
      parseHeadOrEyeCommand(&headX, &headY, command);
      STServo.WriteSpeed(ID_HEAD_HORIZONTAL, 0);
      STServo.WriteAcc(ID_HEAD_HORIZONTAL, 0);
      STServo.WritePosition(ID_HEAD_HORIZONTAL, headX);
      STServo.WritePosition(ID_HEAD_VERTICAL, headY);
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