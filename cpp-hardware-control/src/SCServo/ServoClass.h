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
  int WritePosition(s16 Position);  // general write for single servo
  int WriteSpeed(s16 Speed);
  int WriteAcceleration(u8 Acceleration);

  int EnableTorque(u8 ID, u8 Enable);  // torque ctrl command
  int unLockEprom(u8 ID);              // eprom unlock
  int LockEprom(u8 ID);                // eprom locked
  int SetOffset();                     // set middle position
  int CalibrateOffsetAuto();           // set current position as middle
  int FeedBack(int ID);                // servo information feedback
  int ReadPos(int ID);                 // read position
  int ReadSpeed(int ID);               // read speed
  int ReadLoad(int ID);     // read motor load(0~1000, 1000 = 100% max
                            // load)
  int ReadVoltage(int ID);  // read voltage
  int ReadTemper(int ID);   // read temperature
  int ReadMove(int ID);     // read move mode
  int ReadCurrent(int ID);  // read current
  int ReadMode(int ID);     // read working mode
  // Servo(STS* sts, SCSCL* scs, u8 ID);
};

#endif