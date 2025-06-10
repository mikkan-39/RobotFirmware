import { SerialPort } from "serialport";
import { BaseUartRequestHandler } from "./baseUartRequestHandler";

export enum MainCommands {
  PING = 0x01,
  TOF = 0x02,
  IMU = 0x03,
  DRAW_INIT = 0x04,
  DRAW_LOADING = 0x05,
  DRAW_ERROR = 0x06,
  DRAW_EYES = 0x07,
}

export enum StatusCodes {
  OK = 0x00,
  INVALID_COMMAND = 0x01,
  INVALID_ARG = 0x02,
  WRONG_CHECKSUM = 0x03,
  INCOMPLETE_REQUEST = 0x04,
}

export const DrawEyesArgsEnum = {
  x: 'x',
  y: 'y',
  radius: 'r',
  speed: 's',
  primaryColor: 'p',
  reserveColor: 'u',
  secondaryColor: 'c',
  backgroundColor: 'b',
} as const;

export type DrawEyesArgs = Partial<
  Record<keyof typeof DrawEyesArgsEnum, number>
>;

const tagMap: Record<keyof typeof DrawEyesArgsEnum, { tag: number, len: number }> = {
  x: { tag: 0x01, len: 1 },
  y: { tag: 0x02, len: 1 },
  radius: { tag: 0x03, len: 1 },
  speed: { tag: 0x04, len: 1 },
  backgroundColor: { tag: 0x05, len: 2 },
  primaryColor: { tag: 0x06, len: 2 },
  secondaryColor: { tag: 0x07, len: 2 },
  reserveColor: { tag: 0x08, len: 2 },
};

export class PeripheryRequestHandler extends BaseUartRequestHandler<MainCommands, StatusCodes> {
  constructor(name: string, port: SerialPort) {
    super(name, port);
  }

  protected getExpectedPrefix(): number {
    return 0xAA;
  }

  protected decodeResponse(payload: Buffer, status: number) {
    return { status: status as StatusCodes, payload };
  }

  async ping() {
    return this.sendRaw(this.buildCommandPacket(MainCommands.PING), MainCommands.PING);
  }
  async tof(): Promise<number> {
    const { payload } = await this.sendRaw(this.buildCommandPacket(MainCommands.TOF), MainCommands.TOF);
    if (payload.length !== 2) {
      throw new Error(`[${this.name}] TOF: Expected 2-byte payload, got ${payload.length}`);
    }
    return payload.readUInt16LE(0);
  }
  async imu(): Promise<{ quat: number[], gravVector: number[], acc: number[], gyro: number[] }> {
    const { payload } = await this.sendRaw(this.buildCommandPacket(MainCommands.IMU), MainCommands.IMU);
    if (payload.length !== 52) {
      throw new Error(`[${this.name}] IMU: Expected 52-byte payload, got ${payload.length}`);
    }
    const floats: number[] = [];
    for (let i = 0; i < 13; i++) floats.push(payload.readFloatLE(i * 4));
    return {
      quat: floats.slice(0, 4),
      gravVector: floats.slice(4, 7),
      acc: floats.slice(7, 10),
      gyro: floats.slice(10, 13),
    };
  }
  async drawInit() {
    return this.sendRaw(this.buildCommandPacket(MainCommands.DRAW_INIT), MainCommands.DRAW_INIT);
  }
  async drawLoading() {
    return this.sendRaw(this.buildCommandPacket(MainCommands.DRAW_LOADING), MainCommands.DRAW_LOADING);
  }
  async drawError() {
    return this.sendRaw(this.buildCommandPacket(MainCommands.DRAW_ERROR), MainCommands.DRAW_ERROR);
  }
  async drawEyes(settings: DrawEyesArgs) {
    const payloadParts: Buffer[] = [];
    for (const [key, value] of Object.entries(settings) as [keyof typeof DrawEyesArgsEnum, number][]) {
      const { tag, len } = tagMap[key];
      const buf = Buffer.alloc(2 + len);
      buf[0] = tag;
      buf[1] = len;
      if (len === 1) buf.writeUInt8(value, 2);
      else if (len === 2) buf.writeUInt16LE(value, 2);
      payloadParts.push(buf);
    }
    const payload = Buffer.concat(payloadParts);
    return this.sendRaw(this.buildCommandPacket(MainCommands.DRAW_EYES, payload), MainCommands.DRAW_EYES);
  }
}
