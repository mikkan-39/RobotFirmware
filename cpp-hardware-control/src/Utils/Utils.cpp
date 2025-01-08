#include "Utils.h"

const char* ServoNamesById[] = {
    "NULL",             // ID 0
    "SHOULDER_MAIN_R",  // ID 1
    "SHOULDER_MAIN_L",  // ID 2
    "SHOULDER_TILT_R",  // ID 3
    "SHOULDER_TILT_L",  // ID 4
    "ELBOW_ROTATE_R",   // ID 5
    "ELBOW_ROTATE_L",   // ID 6
    "ELBOW_MAIN_R",     // ID 7
    "ELBOW_MAIN_L",     // ID 8
    "HIP_ROTATE_R",     // ID 9
    "HIP_ROTATE_L",     // ID 10
    "HIP_TILT_R",       // ID 11
    "HIP_TILT_L",       // ID 12
    "HIP_MAIN_R",       // ID 13
    "HIP_MAIN_L",       // ID 14
    "KNEE_R",           // ID 15
    "KNEE_L",           // ID 16
    "FOOT_MAIN_R",      // ID 17
    "FOOT_MAIN_L",      // ID 18
    "FOOT_TILT_R",      // ID 19
    "FOOT_TILT_L",      // ID 20
    "HEAD_HORIZONTAL",  // ID 21
    "HEAD_VERTICAL",    // ID 22
};

void printPingResponses(const bool responses[], size_t size) {
  // Create a stringstream to accumulate the output
  std::ostringstream output;
  // Iterate through the responses and print results
  for (size_t i = 1; i <= size; ++i) {
    if (responses[i]) {
      // Print "OK" for true responses
      output << std::left << std::setw(15)
             << green + "Servo " + std::to_string(i) << std::setw(15)
             << ServoNamesById[i] << " OK" + reset << std::endl;
    } else {
      // Print "WARNING" in yellow for false responses
      output << std::left << std::setw(15)
             << yellow + "Servo " + std::to_string(i) << std::setw(15)
             << ServoNamesById[i] << " WARNING: did not respond" + reset
             << std::endl;
    }
  }

  output << "PING ACK" << std::endl;

  // Output all accumulated text at once
  std::cout << output.str();
}

void parseHeadOrEyeCommand(int* x, int* y, const std::string& command) {
  // Check if the command starts with "HEAD_ROTATE" or "EYES_UPDATE"
  if (command.rfind("HEAD_ROTATE", 0) != 0 &&
      command.rfind("EYES_UPDATE", 0) != 0) {
    std::cerr << "Invalid command format\n";
    return;
  }

  // Extract the arguments after the command
  std::istringstream iss(
      command.substr(11));          // Skip "HEAD_ROTATE " or "EYES_UPDATE "
  std::map<std::string, int> args;  // Map to store named arguments (x, y)

  std::string token;
  while (iss >> token) {
    size_t equalPos = token.find('=');
    if (equalPos != std::string::npos) {
      std::string key = token.substr(0, equalPos);
      std::string value = token.substr(equalPos + 1);

      // Attempt to parse the value as an integer
      try {
        int intValue = std::stoi(value);
        args[key] = intValue;
      } catch (std::invalid_argument&) {
        std::cerr << "Invalid argument: " << value << "\n";
        return;
      }
    } else {
      std::cerr << "Invalid argument format: " << token << "\n";
      return;
    }
  }

  // Update x and y based on the parsed arguments, if they exist
  if (args.find("x") != args.end()) {
    *x = args["x"];
  }
  if (args.find("y") != args.end()) {
    *y = args["y"];
  }
}
