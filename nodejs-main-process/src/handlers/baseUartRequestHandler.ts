import { SerialPort } from "serialport";

const DEFAULT_REQUEST_TIMEOUT_MS = 15;

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

export abstract class BaseUartRequestHandler<CommandType, StatusCodeType, ResponseType = { status: StatusCodeType, payload: Buffer }> {
  protected port: SerialPort;
  protected buffer = Buffer.alloc(0);
  protected pendingPromise: { resolve: (res: ResponseType) => void, reject: (err: any) => void } | null = null;
  protected timeoutHandle: NodeJS.Timeout | null = null;
  protected name: string;
  protected lastCommand: CommandType | null = null;
  protected requestStartTime: bigint | null = null;

  constructor(name: string, port: SerialPort) {
    this.name = name;
    this.port = port;
    this.port.on('data', this.handleData);
  }

  protected abstract decodeResponse(payload: Buffer, status: number): ResponseType;
  protected abstract getExpectedPrefix(): number;

  private handleData = (data: Buffer) => {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 3) {
      const startIdx = this.buffer.indexOf(this.getExpectedPrefix());
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
        throw new Error(`[${this.name}] [${this.lastCommand}] Checksum mismatch: expected ${checksum}, got ${calculated}. \n Packet: ${packet.toString('hex')}`);
      }

      const payload = packet.slice(3, 3 + length);
      const result = this.decodeResponse(payload, status);

      if (this.pendingPromise) {
        const end = process.hrtime.bigint();
        const micros = this.requestStartTime ? Number((end - this.requestStartTime) / 1000n) : -1;
        console.log(`[${this.name}] [${this.lastCommand}] Response received in ${micros} µs:`);
        this.requestStartTime = null;
        this.pendingPromise.resolve(result);
        clearTimeout(this.timeoutHandle!);
        this.pendingPromise = null;
      }

      this.buffer = this.buffer.slice(totalLength);
    }
  };

  protected sendRaw(command: Buffer, commandType: CommandType, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<ResponseType> {
    if (this.pendingPromise) throw new Error(`[${this.name}] Request already pending`);

    // console.log(`sending 0x${command.toString('hex')}`)
    this.port.write(command);
    this.port.drain();
    this.requestStartTime = process.hrtime.bigint();

    this.lastCommand = commandType;

    return new Promise((resolve, reject) => {
      this.pendingPromise = { resolve, reject };
      this.timeoutHandle = setTimeout(() => {
        if (this.pendingPromise) {
          this.pendingPromise.reject(new Error(`[${this.name}] [${this.lastCommand}] Timeout waiting for response`));
          this.pendingPromise = null;
        }
      }, timeoutMs);
    });
  }

  protected buildCommandPacket(command: number, payload: Buffer = Buffer.alloc(0)): Buffer {
    const header = Buffer.from([this.getExpectedPrefix(), command, payload.length]);
    const noChecksum = Buffer.concat([header, payload]);
    const checksum = calculateChecksum(noChecksum);
    return Buffer.concat([noChecksum, Buffer.from([checksum])]);
  }
}
