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
  output << "SERVOS_QUERY_POSITIONS: {";
  for (int i = 1; i <= NUM_SERVOS; i++) {
    output << "\"" << i << "\"" << ": " << servoPositions[i]
           << (i <= NUM_SERVOS - 1 ? ", " : "");
  }
  output << "}" << std::endl;
  std::cout << output.str();
}

void handleQueryServoMoving(STS STServo, int NUM_SERVOS) {
  bool servoMoving[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    bool moving = STServo.readByte(id, STS_MOVING);
    servoMoving[id] = moving;
  }

  std::ostringstream output;
  output << "SERVOS_QUERY_MOVING: {";
  for (int i = 1; i <= NUM_SERVOS; i++) {
    output << "\"" << i << "\"" << ": " << servoMoving[i]
           << (i <= NUM_SERVOS - 1 ? ", " : "");
  }
  output << "}" << std::endl;
  std::cout << output.str();
}

void handleQueryServoSpeed(STS STServo, int NUM_SERVOS) {
  int servoSpeed[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    int speed = STServo.readWord(id, STS_PRESENT_SPEED_L);
    servoSpeed[id] = speed;
  }

  std::ostringstream output;
  output << "SERVOS_QUERY_SPEED: {";
  for (int i = 1; i <= NUM_SERVOS; i++) {
    output << "\"" << i << "\"" << ": " << servoSpeed[i]
           << (i <= NUM_SERVOS - 1 ? ", " : "");
  }
  output << "}" << std::endl;
  std::cout << output.str();
}

void handleSetServoPositions(STS STServo, const std::string& command) {
  std::istringstream iss(command);
  std::string commandType;
  iss >> commandType;

  int regAddress = STS_GOAL_POSITION_L;

  if (commandType == "SET_SERVO_SPEED") {
    regAddress = STS_GOAL_SPEED_L;
  }
  if (commandType == "SET_SERVO_ENABLED") {
    regAddress = STS_TORQUE_ENABLE;
  }
  if (commandType == "SET_SERVO_TORQUE") {
    regAddress = STS_TORQUE_LIMIT_L;
  }
  if (commandType == "SET_SERVO_ACCELERATION") {
    regAddress = STS_ACC;
  }

  std::vector<u8> servoIDs;
  std::vector<u16> values;

  std::string pair;
  while (iss >> pair) {
    auto equalPos = pair.find('=');
    if (equalPos == std::string::npos) {
      std::cerr << "Malformed pair: " << pair << std::endl;
      continue;
    }

    u8 id = static_cast<u8>(std::stoi(pair.substr(0, equalPos)));
    u16 value = static_cast<u16>(std::stoi(pair.substr(equalPos + 1)));

    servoIDs.push_back(id);
    values.push_back(value);
  }

  // Either 8 or 16-bit values
  if (regAddress == STS_TORQUE_ENABLE || regAddress == STS_ACC) {
    std::vector<uint8_t> values_u8;
    for (uint16_t value : values) {
      values_u8.push_back(
          static_cast<uint8_t>(value & 0xFF));  // Keep only the lower 8 bits
    }
    if (servoIDs.size() == 1) {
      STServo.writeByte(servoIDs[0], regAddress, values[0]);
    } else if (!servoIDs.empty()) {
      STServo.SyncWriteByte(servoIDs.data(), servoIDs.size(), values_u8.data(),
                            regAddress);
    }
  } else {
    if (servoIDs.size() == 1) {
      STServo.writeWord(servoIDs[0], regAddress, values[0]);
    } else if (!servoIDs.empty()) {
      STServo.SyncWriteWord(servoIDs.data(), servoIDs.size(), values.data(),
                            regAddress);
    }
  }
}