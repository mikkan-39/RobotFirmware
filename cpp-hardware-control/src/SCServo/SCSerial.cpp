#include "SCSerial.h"

SCSerial::SCSerial() {
  IOTimeOut = 100;
  serial_fd = -1;
  Err = 0;
}

SCSerial::SCSerial(u8 End) : SCS(End) {
  IOTimeOut = 100;
  serial_fd = -1;
  Err = 0;
}

SCSerial::SCSerial(u8 End, u8 Level) : SCS(End, Level) {
  IOTimeOut = 100;
  serial_fd = -1;
  Err = 0;
}

// Open the serial port
int SCSerial::openSerial(const char *device) {
  serial_fd = serialOpen(device, 9600);  // Open the serial port at 9600 baud
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
    ComData = serialGetchar(serial_fd);  // Use WiringPi's serialGetchar
    if (ComData != -1) {
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
int SCSerial::writeSCS(unsigned char *nDat, int nLen) {
  if (nDat == NULL) {
    return 0;
  }
  return serialPuts(serial_fd, (char *)nDat);  // Use WiringPi's serialPuts
}

// Write a single byte to the serial port
int SCSerial::writeSCS(unsigned char bDat) {
  return serialPutchar(serial_fd, bDat);  // Use WiringPi's serialPutchar
}

// Flush the read buffer
void SCSerial::rFlushSCS() {
  while (serialDataAvail(serial_fd)) {
    serialGetchar(serial_fd);  // Discard any unread data
  }
}

// Flush the write buffer (no action needed in WiringPi, but left here for
// consistency)
void SCSerial::wFlushSCS() {
  // No need for a flush in WiringPi since the data is immediately sent
}
