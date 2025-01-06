#include <errno.h>
#include <string.h>

#include <iostream>
#include <string>

#include "SCServo/SCServo.h"
#include "SCServo/ServoClass.h"
#include "Utils/Utils.h"

STS STServo;
const char* serialPath = "/dev/ttyAMA4";

#define NUM_SERVOS 22

int main() {
  std::cout << "C++ subsystem started." << std::endl;

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

  Servo* Servos[NUM_SERVOS + 1];

  std::cout << "Servo handler initialized." << std::endl;

  bool pingResponses[NUM_SERVOS];
  unsigned long startTime = micros();
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    bool initialized = STServo.Ping(id) != -1;
    pingResponses[id] = initialized;
    Servos[id] = new Servo(&STServo, id, initialized);
  }
  unsigned long endTime = micros() - startTime;

  std::cout << std::to_string(endTime) << std::endl;

  printPingResponses(pingResponses, NUM_SERVOS);

  std::string command;
  while (true) {
    std::getline(std::cin, command);  // Read command from stdin

    if (command.empty()) {
      continue;  // Just skip this iteration and wait for a new command
    }

    if (command == "CALLBACK PING") {
      std::cout << "Ping acknowledged by C++." << std::endl;
    } else if (command == "EXIT") {
      std::cout << "Exiting C++..." << std::endl;
      break;
    } else {
      std::cout << "Unknown command to C++: " << command << std::endl;
    }
  }

  return 0;
}