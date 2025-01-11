#include "SCSerial.h"

#include <iostream>

SCSerial::SCSerial() {
  IOTimeOut = 100;
  serial_fd = -1;
  Err = 0;
}

SCSerial::SCSerial(u8 End) : SComms(End) {
  IOTimeOut = 100;
  serial_fd = -1;
  Err = 0;
}

SCSerial::SCSerial(u8 End, u8 Level) : SComms(End, Level) {
  IOTimeOut = 100;
  serial_fd = -1;
  Err = 0;
}

// Open the serial port
int SCSerial::openSerial(const char *device) {
  serial_fd = serialOpen(device, 1000000);  // Open the serial port
  if (serial_fd == -1) {
    Err = -1;
    return -1;  // Error opening serial port
  }
  return 0;
}

// Read data from the serial port
int SCSerial::readSCS(unsigned char *nDat, int nLen) {
  int Size = 0;
  int ComData;
  unsigned long t_begin = millis();
  unsigned long t_user;

  while (1) {
    if (serialDataAvail(serial_fd)) {
      ComData = serialGetchar(serial_fd);
      if (nDat) {
        nDat[Size] = ComData;
      }
      Size++;
      t_begin = millis();
    }

    if (Size >= nLen) {
      break;
    }

    t_user = millis() - t_begin;
    if (t_user > IOTimeOut) {
      break;  // Timeout
    }
  }

  return Size;
}

// Write data to the serial port
void SCSerial::writeSCS(unsigned char *nDat, int nLen) {
  for (int i = 0; i < nLen; ++i) {
    serialPutchar(serial_fd, nDat[i]);
  }
}

// Write a single byte to the serial port
void SCSerial::writeSCS(unsigned char bDat) {
  serialPutchar(serial_fd, bDat);  // Use WiringPi's serialPutchar
}

// Flush the read buffer
void SCSerial::rFlushSCS() {
  while (serialDataAvail(serial_fd)) {
    unsigned char dat = serialGetchar(serial_fd);  // Discard any unread data
    std::cout << "FlushingData " << std::to_string(dat) << std::endl;
  }
}

// Flush the write buffer (no action needed in WiringPi, but left here for
// consistency)
void SCSerial::wFlushSCS() {
  // No need for a flush in WiringPi since the data is immediately sent
}
