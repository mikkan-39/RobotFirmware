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

void handlePing(STS STServo, int NUM_SERVOS) {
  bool pingResponses[NUM_SERVOS];
  int majors[NUM_SERVOS];
  int minors[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    bool initialized = STServo.Ping(id) != -1;
    pingResponses[id] = initialized;
    if (initialized) {
      majors[id] = STServo.readByte(id, 0);
      minors[id] = STServo.readByte(id, 1);
    }
  }
  // Create a stringstream to accumulate the output
  std::ostringstream output;
  // Iterate through the responses and print results
  for (size_t i = 1; i <= NUM_SERVOS; ++i) {
    if (pingResponses[i]) {
      // Print "OK" for true responses
      output << std::left << std::setw(15)
             << green + "Servo " + std::to_string(i) << std::setw(15)
             << ServoNamesById[i] << " OK "
             << "Firmware ver: " << std::to_string(majors[i]) << "."
             << std::to_string(minors[i]) << reset << std::endl;
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
    int position = STServo.ReadPos(id);
    servoPositions[id] = position;
  }

  std::ostringstream output;
  output << "SERVOS_QUERY_POSITIONS: {";
  for (int i = 1; i <= NUM_SERVOS; i++) {
    if (servoPositions[i] != -1) {
      output << "\"" << i << "\"" << ": " << servoPositions[i]
             << (i <= NUM_SERVOS - 1 ? ", " : "");
    }
  }
  output << "}" << std::endl;
  std::cout << output.str();
}

void handleQueryServoMoving(STS STServo, int NUM_SERVOS) {
  bool servoMoving[NUM_SERVOS];
  for (u8 id = 1; id <= NUM_SERVOS; id++) {
    bool moving = STServo.ReadMove(id);
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
    s16 value = static_cast<s16>(std::stoi(pair.substr(equalPos + 1)));

    STServo.WritePosition(id, value);
    // servoIDs.push_back(id);
    // values.push_back(value);
  }

  // if (!servoIDs.empty()) {
  //   STServo.SyncWriteWord(servoIDs.data(), servoIDs.size(), values.data(),
  //                         STS_GOAL_POSITION_L);
  // }
}

void handleSetServoSpeeds(STS STServo, const std::string& command) {
  std::istringstream iss(command);
  std::string commandType;
  iss >> commandType;

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

    STServo.WriteSpeed(id, value);
    // servoIDs.push_back(id);
    // values.push_back(value);
  }

  // if (!servoIDs.empty()) {
  //   STServo.SyncWriteWord(servoIDs.data(), servoIDs.size(), values.data(),
  //                         STS_GOAL_SPEED_L);
  // }
}

void handleSetServoTorque(STS STServo, const std::string& command) {
  std::istringstream iss(command);
  std::string commandType;
  iss >> commandType;

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

    if (value == 0) {
      value = 1000;
    }
    STServo.WriteTorque(id, value);
    // servoIDs.push_back(id);
    // values.push_back(value);
  }

  // if (!servoIDs.empty()) {
  //   STServo.SyncWriteWord(servoIDs.data(), servoIDs.size(), values.data(),
  //                         STS_TORQUE_LIMIT_L);
  // }
}

void handleSetServoEnabled(STS STServo, const std::string& command) {
  // std::istringstream iss(command);
  // std::string commandType;
  // iss >> commandType;

  // std::vector<u8> servoIDs;
  // std::vector<u8> values;

  // std::string pair;
  // while (iss >> pair) {
  //   auto equalPos = pair.find('=');
  //   if (equalPos == std::string::npos) {
  //     std::cerr << "Malformed pair: " << pair << std::endl;
  //     continue;
  //   }

  //   u8 id = static_cast<u8>(std::stoi(pair.substr(0, equalPos)));
  //   u8 value = static_cast<u8>(std::stoi(pair.substr(equalPos + 1)));

  //   servoIDs.push_back(id);
  //   values.push_back(value);
  // }

  // if (!servoIDs.empty()) {
  //   STServo.SyncWriteByte(servoIDs.data(), servoIDs.size(), values.data(),
  //                         STS_TORQUE_ENABLE);
  // }
}