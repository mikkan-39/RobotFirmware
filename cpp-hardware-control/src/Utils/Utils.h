#ifndef _UTILS_H
#define _UTILS_H

#include <iomanip>  // For formatting table output
#include <iostream>
#include <map>
#include <sstream>  // For std::ostringstream]
#include <string>

#include "../SCServo/SCServo.h"

const std::string red = "\033[31m";
const std::string yellow = "\033[33m";
const std::string green = "\033[32m";
const std::string blue = "\033[34m";
const std::string reset = "\033[0m";

void printPingResponses(const bool responses[], size_t size);
void parseHeadOrEyeCommand(int* x, int* y, const std::string& command);

#endif