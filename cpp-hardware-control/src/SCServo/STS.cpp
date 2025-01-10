/*
 * STS.cpp
 * application layer for waveshare ST servos
 */

#include "STS.h"

STS::STS() { End = 0; }

STS::STS(u8 End) : SCSerial(End) {}

STS::STS(u8 End, u8 Level) : SCSerial(End, Level) {}

int STS::WritePosSpeedAcc(u8 ID, s16 Position, u16 Speed, u8 ACC) {
  if (Position < 0) {
    Position = -Position;
    Position |= (1 << 15);
  }
  u8 bBuf[7];
  bBuf[0] = ACC;
  Host2SCS(bBuf + 1, bBuf + 2, Position);
  Host2SCS(bBuf + 3, bBuf + 4, 0);
  Host2SCS(bBuf + 5, bBuf + 6, Speed);

  return genWrite(ID, STS_ACC, bBuf, 7);
}

int STS::WritePosition(u8 ID, u16 Position) {
  u8 bBuf[2];
  Host2SCS(bBuf + 0, bBuf + 1, Position);
  return genWrite(ID, STS_GOAL_POSITION_L, bBuf, 2);
}

int STS::WriteSpeed(u8 ID, u16 Speed) {
  u8 bBuf[2];
  Host2SCS(bBuf + 0, bBuf + 1, Speed);
  return genWrite(ID, STS_GOAL_SPEED_L, bBuf, 2);
}

int STS::WriteAcc(u8 ID, u8 ACC) { return writeByte(ID, STS_ACC, ACC); }

int STS::WritePosSpeedAccAsync(u8 ID, u16 Position, u16 Speed, u8 ACC) {
  u8 bBuf[7];
  bBuf[0] = ACC;
  Host2SCS(bBuf + 1, bBuf + 2, Position);
  Host2SCS(bBuf + 3, bBuf + 4, 0);
  Host2SCS(bBuf + 5, bBuf + 6, Speed);

  return regWrite(ID, STS_ACC, bBuf, 7);
}

void STS::SyncWriteWord(u8 ID[], u8 IDN, u16 Values[], u8 MemAddr) {
  u8 offbuf[2 * IDN];
  for (u8 i = 0; i < IDN; i++) {
    Host2SCS(offbuf + i * 2, offbuf + i * 2 + 1, Values[i]);
  }
  syncWrite(ID, IDN, MemAddr, offbuf, 2);
}

void STS::SyncWriteByte(u8 ID[], u8 IDN, u8 Values[], u8 MemAddr) {
  syncWrite(ID, IDN, MemAddr, Values, 2);
}

int STS::WheelMode(u8 ID) { return writeByte(ID, STS_MODE, 1); }

int STS::WriteSpe(u8 ID, s16 Speed, u8 ACC) {
  if (Speed < 0) {
    Speed = -Speed;
    Speed |= (1 << 15);
  }
  u8 bBuf[2];
  bBuf[0] = ACC;
  genWrite(ID, STS_ACC, bBuf, 1);
  Host2SCS(bBuf + 0, bBuf + 1, Speed);

  return genWrite(ID, STS_GOAL_SPEED_L, bBuf, 2);
}

int STS::EnableTorque(u8 ID, u8 Enable) {
  return writeByte(ID, STS_TORQUE_ENABLE, Enable);
}

int STS::unLockEprom(u8 ID) { return writeByte(ID, STS_LOCK, 0); }

int STS::LockEprom(u8 ID) { return writeByte(ID, STS_LOCK, 1); }

int STS::CalibrationOfs(u8 ID) { return writeByte(ID, STS_TORQUE_ENABLE, 128); }

int STS::FeedBack(int ID) {
  int nLen = Read(ID, STS_PRESENT_POSITION_L, Mem, sizeof(Mem));
  if (nLen != sizeof(Mem)) {
    Err = 1;
    return -1;
  }
  Err = 0;
  return nLen;
}

int STS::ReadPos(int ID) {
  int Pos = -1;
  if (ID == -1) {
    Pos = Mem[STS_PRESENT_POSITION_H - STS_PRESENT_POSITION_L];
    Pos <<= 8;
    Pos |= Mem[STS_PRESENT_POSITION_L - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Pos = readWord(ID, STS_PRESENT_POSITION_L);
    if (Pos == -1) {
      Err = 1;
    }
  }
  if (!Err && (Pos & (1 << 15))) {
    Pos = -(Pos & ~(1 << 15));
  }

  return Pos;
}

int STS::ReadSpeed(int ID) {
  int Speed = -1;
  if (ID == -1) {
    Speed = Mem[STS_PRESENT_SPEED_H - STS_PRESENT_POSITION_L];
    Speed <<= 8;
    Speed |= Mem[STS_PRESENT_SPEED_L - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Speed = readWord(ID, STS_PRESENT_SPEED_L);
    if (Speed == -1) {
      Err = 1;
      return -1;
    }
  }
  if (!Err && (Speed & (1 << 15))) {
    Speed = -(Speed & ~(1 << 15));
  }
  return Speed;
}

int STS::ReadLoad(int ID) {
  int Load = -1;
  if (ID == -1) {
    Load = Mem[STS_PRESENT_LOAD_H - STS_PRESENT_POSITION_L];
    Load <<= 8;
    Load |= Mem[STS_PRESENT_LOAD_L - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Load = readWord(ID, STS_PRESENT_LOAD_L);
    if (Load == -1) {
      Err = 1;
    }
  }
  if (!Err && (Load & (1 << 10))) {
    Load = -(Load & ~(1 << 10));
  }
  return Load;
}

int STS::ReadVoltage(int ID) {
  int Voltage = -1;
  if (ID == -1) {
    Voltage = Mem[STS_PRESENT_VOLTAGE - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Voltage = readByte(ID, STS_PRESENT_VOLTAGE);
    if (Voltage == -1) {
      Err = 1;
    }
  }
  return Voltage;
}

int STS::ReadTemper(int ID) {
  int Temper = -1;
  if (ID == -1) {
    Temper = Mem[STS_PRESENT_TEMPERATURE - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Temper = readByte(ID, STS_PRESENT_TEMPERATURE);
    if (Temper == -1) {
      Err = 1;
    }
  }
  return Temper;
}

int STS::ReadMove(int ID) {
  int Move = -1;
  if (ID == -1) {
    Move = Mem[STS_MOVING - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Move = readByte(ID, STS_MOVING);
    if (Move == -1) {
      Err = 1;
    }
  }
  return Move;
}

int STS::ReadMode(int ID) {
  int Mode = -1;
  if (ID == -1) {
    Mode = Mem[STS_MODE - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Mode = readByte(ID, STS_MODE);
    if (Mode == -1) {
      Err = 1;
    }
  }
  return Mode;
}

int STS::ReadCurrent(int ID) {
  int Current = -1;
  if (ID == -1) {
    Current = Mem[STS_PRESENT_CURRENT_H - STS_PRESENT_POSITION_L];
    Current <<= 8;
    Current |= Mem[STS_PRESENT_CURRENT_L - STS_PRESENT_POSITION_L];
  } else {
    Err = 0;
    Current = readWord(ID, STS_PRESENT_CURRENT_L);
    if (Current == -1) {
      Err = 1;
      return -1;
    }
  }
  if (!Err && (Current & (1 << 15))) {
    Current = -(Current & ~(1 << 15));
  }
  return Current;
}
