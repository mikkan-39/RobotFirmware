/*
 * SCSerial.h
 * hardware interface layer for waveshare serial bus servo
 */

#ifndef _SCSERIAL_H
#define _SCSERIAL_H

#include <wiringPi.h>
#include <wiringSerial.h>  // For WiringPi serial functions

#include "SComms.h"

class SCSerial : public SComms {
 public:
  SCSerial();
  SCSerial(u8 End);
  SCSerial(u8 End, u8 Level);
  int openSerial(const char *device);  // open serial

 protected:
  virtual void writeSCS(unsigned char *nDat, int nLen);  // output nLen byte
  virtual int readSCS(unsigned char *nDat, int nLen);    // input nLen byte
  virtual void writeSCS(unsigned char bDat);             // output 1 byte
  virtual void rFlushSCS();                              // flush read buffer
  virtual void wFlushSCS();                              // flush write buffer

 public:
  unsigned long int IOTimeOut;  // I/O timeout
  int serial_fd;                // File descriptor for WiringPi serial
  int Err;

 public:
  virtual int getErr() { return Err; }
};

#endif
