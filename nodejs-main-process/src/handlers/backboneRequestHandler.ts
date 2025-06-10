import { SerialPort } from "serialport";
import { BaseUartRequestHandler } from "./baseUartRequestHandler";

export enum BackboneCommands {
  PING = 0x01,
  QUERY_POSITIONS = 0x02,
  QUERY_SPEED = 0x03,
  SET_POS = 0x04,
  SET_SPEED = 0x05,
  SET_ENABLED = 0x06,
  EXIT = 0x07,
}

export enum BackboneStatusCodes {
  OK = 0x00,
  INVALID_COMMAND = 0x01,
  INVALID_ARG = 0x02,
  WRONG_CHECKSUM = 0x03,
  INCOMPLETE_REQUEST = 0x04,
  BUFFER_OVERFLOW = 0x05,
  NO_SERVOS = 0x06,
  LOCKOUT_FAIL = 0x07,
}

type Response = {
  status: BackboneStatusCodes;
  payload: Buffer;
};


export class BackboneRequestHandler extends BaseUartRequestHandler<BackboneCommands, BackboneStatusCodes> {
  constructor(name: string, port: SerialPort) {
    super(name, port);
  }

  protected getExpectedPrefix(): number {
    return 0xAA;
  }

  protected decodeResponse(payload: Buffer, status: number) {
    return { status: status as BackboneStatusCodes, payload };
  }

  private buildInt16Payload(data: Record<number, number | undefined>): Buffer {
    const buffers: Buffer[] = [];
    for (const [id, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const buf = Buffer.alloc(3);
      buf[0] = parseInt(id);
      buf.writeInt16LE(value, 1);
      buffers.push(buf);
    }
    return Buffer.concat(buffers);
  }

  private decodePingResponse(res: Response): Record<number, number> {
    const result: Record<number, number> = {};
    for (let i = 0; i < res.payload.length; i += 2) {
      const id = res.payload[i]!;
      const status = res.payload[i + 1]!;
      result[id] = status;
    }
    return result;
  }

  private decodeServoInt16Map(payload: Buffer): Record<number, number> {
    const result: Record<number, number> = {};
    for (let i = 0; i < payload.length; i += 3) {
      const id = payload[i]!;
      const raw = payload.readInt16LE(i + 1);

      // Uses a dumb custom 15-bit unsigned value with a sign bit
      const isNegative = (raw & 0x8000) !== 0;
      const magnitude = raw & 0x7FFF;
      const value = isNegative ? -magnitude : magnitude;

      result[id] = value;
    }
    return result;
  }

  /**
   * Check & setup available servos.
   */
  async ping() {
    const packet = this.buildCommandPacket(BackboneCommands.PING);
    const res = await this.sendRaw(packet, BackboneCommands.PING);
    return this.decodePingResponse(res);
  }

  /** 
   * Get servo positions.
   */
  async queryPositions() {
    const packet = this.buildCommandPacket(BackboneCommands.QUERY_POSITIONS);
    const res = await this.sendRaw(packet, BackboneCommands.QUERY_POSITIONS);
    return this.decodeServoInt16Map(res.payload);
  }

  /**
   * Get servo speeds.
   */
  async querySpeed() {
    const packet = this.buildCommandPacket(BackboneCommands.QUERY_SPEED);
    const res = await this.sendRaw(packet, BackboneCommands.QUERY_SPEED);
    return this.decodeServoInt16Map(res.payload);
  }

  /**
   * Set servo positions.
   * @param data map of servo ids and their desired positions.
   */
  async setPos(data: Record<number, number | undefined>) {
    const payload = this.buildInt16Payload(data);
    const packet = this.buildCommandPacket(BackboneCommands.SET_POS, payload);
    return this.sendRaw(packet, BackboneCommands.SET_POS);
  }

  /**
   * Set servo speed limits.
   * @param data map of servo ids and their speed limits.
   */
  async setSpeed(data: Record<number, number | undefined>) {
    const payload = this.buildInt16Payload(data);
    const packet = this.buildCommandPacket(BackboneCommands.SET_SPEED, payload);
    return this.sendRaw(packet, BackboneCommands.SET_SPEED);
  }

  /**
   * Turn servos on/off.
   * @param data map of servo ids and if they should be enabled.
   */
  async setEnabled(data: Record<number, boolean | undefined>) {
    const payload = Buffer.concat(Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([id, enabled]) => Buffer.from([parseInt(id), Number(enabled)])));

    const packet = this.buildCommandPacket(BackboneCommands.SET_ENABLED, payload);
    return this.sendRaw(packet, BackboneCommands.SET_ENABLED);
  }

  /**
   * Turn all servos off. Should be called on master process exit.
   */
  async exit() {
    const packet = this.buildCommandPacket(BackboneCommands.EXIT);
    return this.sendRaw(packet, BackboneCommands.EXIT);
  }

}
