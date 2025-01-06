#include "Utils.h"

void printPingResponses(const bool responses[], size_t size) {
    // Create a stringstream to accumulate the output
  std::ostringstream output;

  // Iterate through the responses and print results
  for (size_t i = 1; i <= size; ++i) {
    if (responses[i]) {
      // Print "OK" for true responses
      output << "Servo " + std::to_string(i) + " OK" << std::endl;
    } else {
      // Print "WARNING" in yellow for false responses
      output << yellow + "Servo " + std::to_string(i) +
                    " WARNING: did not respond" + reset
             << std::endl;
    }
  }

  // Output all accumulated text at once
  std::cout << output.str();
}