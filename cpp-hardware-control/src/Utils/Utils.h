#ifndef _UTILS_H
#define _UTILS_H

#include <iomanip>  // For formatting table output
#include <iostream>
#include <sstream>  // For std::ostringstream

const std::string red = "\033[31m";
const std::string yellow = "\033[33m";
const std::string reset = "\033[0m";

void printPingResponses(const bool responses[], size_t size);

#endif