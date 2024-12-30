#include <iostream>
#include <string>

#include "SCServo/SCServo.h"
STS STServo;
const char *serialPath = "/dev/serial1";

int main() {
  STServo.openSerial(serialPath);

  std::cout << "C++ subsystem started." << std::endl;

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