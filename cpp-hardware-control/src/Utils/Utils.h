#ifndef _UTILS_H
#define _UTILS_H

#include <iomanip>  // For formatting table output
#include <iostream>
#include <map>
#include <sstream>  // For std::ostringstream]
#include <string>
#include <vector>

#include "../SCServo/SCServo.h"

const std::string red = "\033[31m";
const std::string yellow = "\033[33m";
const std::string green = "\033[32m";
const std::string blue = "\033[34m";
const std::string reset = "\033[0m";

void handlePing(STS STServo, int NUM_SERVOS);
void handleQueryServoPositions(STS STServo, int NUM_SERVOS);
void handleQueryServoMoving(STS STServo, int NUM_SERVOS);
void handleQueryServoSpeed(STS STServo, int NUM_SERVOS);

void handleSetServoPositions(STS STServo, const std::string& command);
#endif