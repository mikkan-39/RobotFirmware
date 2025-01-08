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
  // Check if the command starts with "HEAD_ROTATE"
  if (command.rfind("HEAD_ROTATE", 0) != 0 &&
      command.rfind("EYES_UPDATE", 0) != 0) {
    std::cerr << "Invalid command format\n";
    return;
  }

  // Extract the arguments after the command
  std::istringstream iss(command.substr(11));  // Skip "HEAD_ROTATE "
  std::string token;
  int parsedX = *x;  // Initialize with last known values
  int parsedY = *y;

  // Parse the tokens
  bool xProvided = false, yProvided = false;
  while (iss >> token) {
    try {
      int value = std::stoi(token);
      if (!xProvided) {
        parsedX = value;
        xProvided = true;
      } else if (!yProvided) {
        parsedY = value;
        yProvided = true;
      } else {
        std::cerr << "Unexpected extra arguments\n";
        return;
      }
    } catch (std::invalid_argument& e) {
      std::cerr << "Invalid argument: " << token << "\n";
      return;
    }
  }

  // Update the x and y values
  *x = parsedX;
  *y = parsedY;
}