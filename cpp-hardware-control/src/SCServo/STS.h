/*
 * STS.h
 * application layer for waveshare ST servos.
 */

#ifndef _STS_H
#define _STS_H

// memory table definition
//-------EPROM(read only)--------
#define STS_MODEL_L 3
#define STS_MODEL_H 4

//-------EPROM(read & write)--------
#define STS_ID 5
#define STS_BAUD_RATE 6
#define STS_MIN_ANGLE_LIMIT_L 9
#define STS_MIN_ANGLE_LIMIT_H 10
#define STS_MAX_ANGLE_LIMIT_L 11
#define STS_MAX_ANGLE_LIMIT_H 12
#define STS_CW_DEAD 26
#define STS_CCW_DEAD 27
#define STS_OFS_L 31
#define STS_OFS_H 32
#define STS_MODE 33

//-------SRAM(read & write)--------
#define STS_TORQUE_ENABLE 40
#define STS_ACC 41
#define STS_GOAL_POSITION_L 42
#define STS_GOAL_POSITION_H 43
#define STS_GOAL_TIME_L 44
#define STS_GOAL_TIME_H 45
#define STS_GOAL_SPEED_L 46
#define STS_GOAL_SPEED_H 47
#define STS_TORQUE_LIMIT_L 48
#define STS_TORQUE_LIMIT_H 49
#define STS_LOCK 55

//-------SRAM(read only)--------
#define STS_PRESENT_POSITION_L 56
#define STS_PRESENT_POSITION_H 57
#define STS_PRESENT_SPEED_L 58
#define STS_PRESENT_SPEED_H 59
#define STS_PRESENT_LOAD_L 60
#define STS_PRESENT_LOAD_H 61
#define STS_PRESENT_VOLTAGE 62
#define STS_PRESENT_TEMPERATURE 63
#define STS_MOVING 66
#define STS_PRESENT_CURRENT_L 69
#define STS_PRESENT_CURRENT_H 70

#include "SCSerial.h"

class STS : public SCSerial {
 public:
  STS();
  STS(u8 End);
  STS(u8 End, u8 Level);
  virtual int WritePosSpeedAcc(u8 ID, s16 Position, u16 Speed,
                               u8 ACC = 0);  // general write for single servo
  virtual int WritePosition(u8 ID, u16 Position);
  virtual int WriteSpeed(u8 ID, u16 Speed);
  virtual int WriteAcc(u8 ID, u8 ACC);

  virtual int WritePosSpeedAccAsync(
      u8 ID, s16 Position, u16 Speed,
      u8 ACC = 0);  // position write asynchronously for
                    // single servo(call RegWriteAction
                    // to action)
  virtual void SyncWritePositions(
      u8 ID[], u8 IDN, u16 Position[]);  // write synchronously for multi servos
  virtual int WheelMode(u8 ID);          // speed loop mode
  virtual int WriteSpe(u8 ID, s16 Speed,
                       u8 ACC = 0);            // speed loop mode ctrl command
  virtual int EnableTorque(u8 ID, u8 Enable);  // torque ctrl command
  virtual int unLockEprom(u8 ID);              // eprom unlock
  virtual int LockEprom(u8 ID);                // eprom locked
  virtual int CalibrationOfs(u8 ID);           // set middle position
  virtual int FeedBack(int ID);                // servo information feedback
  virtual int ReadPos(int ID);                 // read position
  virtual int ReadSpeed(int ID);               // read speed
  virtual int ReadLoad(int ID);     // read motor load(0~1000, 1000 = 100%
                                    // max load)
  virtual int ReadVoltage(int ID);  // read voltage
  virtual int ReadTemper(int ID);   // read temperature
  virtual int ReadMove(int ID);     // read move mode
  virtual int ReadCurrent(int ID);  // read current
  virtual int ReadMode(int ID);     // read working mode
 private:
  u8 Mem[STS_PRESENT_CURRENT_H - STS_PRESENT_POSITION_L + 1];
};

#endif