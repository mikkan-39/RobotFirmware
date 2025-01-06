/*
 * ServoClass.h
 * servo abstraction
 */

#ifndef _SERVOCLASS_H
#define _SERVOCLASS_H

#include "SCServo.h"

class Servo {
 private:
  STS* stsInstance;    // Pointer to an STS instance
  SCSCL* scsInstance;  // Pointer to an SCS instance

 public:
  // Constructor
  Servo(STS* sts, u8 ID, bool initialized);
  // Servo(STS* sts, SCSCL* scs, u8 ID);
};

#endif