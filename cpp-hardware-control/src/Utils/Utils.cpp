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
    "HIP_MAIN_L",       // ID 12
    "HIP_MAIN_R",       // ID 13
    "HIP_TILT_L",       // ID 14
    "KNEE_R",           // ID 15
    "KNEE_L",           // ID 16
    "FOOT_MAIN_R",      // ID 17
    "FOOT_MAIN_L",      // ID 18
    "FOOT_TILT_R",      // ID 19
    "FOOT_TILT_L",      // ID 20
    "HEAD_HORIZONTAL",  // ID 21
    "HEAD_VERTICAL",    // ID 22
};

void handlePing(STS STServo, int NUM_SERVOS) {
  bool pingResponses[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    bool initialized = STServo.Ping(id) != -1;
    pingResponses[id] = initialized;
  }
  // Create a stringstream to accumulate the output
  std::ostringstream output;
  // Iterate through the responses and print results
  for (size_t i = 1; i <= NUM_SERVOS; ++i) {
    if (pingResponses[i]) {
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

void handleQueryServoPositions(STS STServo, int NUM_SERVOS) {
  int servoPositions[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    int position = STServo.readWord(id, STS_PRESENT_POSITION_L);
    servoPositions[id] = position;
  }

  std::ostringstream output;
  output << "SERVOS_QUERY: {";
  for (int i = 1; i <= NUM_SERVOS; i++) {
    output << "\"" << i << "\"" << ": " << servoPositions[i]
           << (i <= NUM_SERVOS - 1 ? ", " : "");
  }
  output << "}" << std::endl;
  std::cout << output.str();
}

void handleSetServoPositions(STS STServo, const std::string& command) {
  std::istringstream iss(command);
  std::string commandType;
  iss >> commandType;

  if (commandType != "SET_SERVO_POS") {
    std::cerr << "Unknown command type: " << commandType << std::endl;
    return;
  }

  std::vector<u8> servoIDs;
  std::vector<u16> positions;

  std::string pair;
  while (iss >> pair) {
    auto equalPos = pair.find('=');
    if (equalPos == std::string::npos) {
      std::cerr << "Malformed pair: " << pair << std::endl;
      continue;
    }

    u8 id = static_cast<u8>(std::stoi(pair.substr(0, equalPos)));
    u16 position = static_cast<u16>(std::stoi(pair.substr(equalPos + 1)));

    servoIDs.push_back(id);
    positions.push_back(position);
  }

  if (servoIDs.size() == 1) {
    STServo.WritePosition(servoIDs[0], positions[0]);
  } else if (!servoIDs.empty()) {
    STServo.SyncWritePositions(servoIDs.data(), servoIDs.size(),
                               positions.data());
  }
}