#include <iostream>
#include <string>

int main() {
  std::cout << "C++ subsystem started." << std::endl;

  std::string command;
  while (true) {
    std::getline(std::cin, command);  // Read command from stdin

    if (command.empty()) {
      continue;  // Just skip this iteration and wait for a new command
    }

    if (command == "CALLBACK PING") {
      std::cout << "Ping acknowledged." << std::endl;
    } else if (command == "EXIT") {
      std::cout << "Exiting..." << std::endl;
      break;
    } else {
      std::cout << "Unknown command: " << command << std::endl;
    }
  }

  return 0;
}