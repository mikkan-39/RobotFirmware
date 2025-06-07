import { SerialPort } from "serialport";

const DEFAULT_REQUEST_TIMEOUT_MS = 50;

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

function calculateChecksum(data: Buffer): number {
  let crc = 0x00;
  for (let byte of data) {
    let extract = byte;
    for (let i = 0; i < 8; i++) {
      const sum = (crc ^ extract) & 0x01;
      crc >>= 1;
      if (sum) crc ^= 0x8C;
      extract >>= 1;
    }
  }
  return crc;
}

export default class BackboneRequestResponseHandler {
  private port: SerialPort;
  private buffer = Buffer.alloc(0);
  private pendingPromise: { resolve: (response: Response) => void; reject: (err: any) => void } | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private name: string;
  private lastCommand: BackboneCommands | null = null;

  constructor(name: string, port: SerialPort) {
    this.name = name;
    this.port = port;
    this.port.on('data', this.handleData);
  }

  private handleData = (data: Buffer) => {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 1) {
      const startIdx = this.buffer.indexOf(0xAA);
      if (startIdx === -1) {
        this.buffer = Buffer.alloc(0);
        return;
      }
      if (startIdx > 0) this.buffer = this.buffer.slice(startIdx);
      if (this.buffer.length < 3) return;

      const status = this.buffer[1]!;
      const length = this.buffer[2]!;
      const totalLength = 3 + length + 1;

      if (this.buffer.length < totalLength) return;

      const packet = this.buffer.slice(0, totalLength);
      const checksum = packet[totalLength - 1];
      const calculated = calculateChecksum(packet.slice(0, totalLength - 1));

      if (calculated !== checksum) {
        console.warn(`[${this.name}] Checksum mismatch: expected ${checksum}, got ${calculated}`);
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const payload = packet.slice(3, 3 + length);
      const result = { status: status as BackboneStatusCodes, payload };

      if (this.pendingPromise) {
        console.log(`[${this.name}] Response received:`, result);
        this.pendingPromise.resolve(result);
        clearTimeout(this.timeoutHandle!);
        this.pendingPromise = null;
      }

      this.buffer = this.buffer.slice(totalLength);
    }
  };

  private sendRaw(command: Buffer, commandType: BackboneCommands, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Response> {
    if (this.pendingPromise) throw new Error(`[${this.name}] Request already pending`);

    this.port.write(command);
    this.port.drain();

    this.lastCommand = commandType;

    return new Promise((resolve, reject) => {
      this.pendingPromise = { resolve, reject };
      this.timeoutHandle = setTimeout(() => {
        if (this.pendingPromise) {
          this.pendingPromise.reject(new Error(`[${this.name}] Timeout waiting for response`));
          this.pendingPromise = null;
        }
      }, timeoutMs);
    });
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

  private buildCommandPacket(command: BackboneCommands, payload: Buffer = Buffer.alloc(0)): Buffer {
    const header = Buffer.from([0xAA, command, payload.length]);
    const withoutChecksum = Buffer.concat([header, payload]);
    const checksum = calculateChecksum(withoutChecksum);
    return Buffer.concat([withoutChecksum, Buffer.from([checksum])]);
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
      const value = payload.readInt16LE(i + 1);
      result[id] = value;
    }
    return result;
  }
}
