import { ChildProcessWithoutNullStreams } from "child_process";
import { SerialPort } from "serialport";

const DEFAULT_REQUEST_TIMEOUT_MS = 50;

export default class RequestResponseHandler<CommandType extends string = string> {
  private portOrProcess: SerialPort | ChildProcessWithoutNullStreams;
  private buffer: string = '';
  private pendingPromise: { resolve: (response: string) => void, reject: (err: any) => void } | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private name: string = '';

  constructor(name: string, portOrProcess: SerialPort | ChildProcessWithoutNullStreams) {
    this.name = name;
    this.portOrProcess = portOrProcess;

    if (portOrProcess instanceof SerialPort) {
      portOrProcess.on('data', this.handleData);
    } else {
      portOrProcess.stdout.on('data', this.handleData);
    }
  }

  private handleData = (data: Buffer) => {
    this.buffer += data.toString();

    if (!this.buffer.includes('\n')) {
      return;
    }

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (this.pendingPromise) {
        const result = line.trim()
        console.log(`${this.name} response: ${result}`)
        this.pendingPromise.resolve(result);
        if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
        this.pendingPromise = null;
      }
    }
  };

  send(command: CommandType, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<string> {
    console.log(`${this.name} request: ${command}`)

    if (this.pendingPromise) {
      throw new Error(`${this.name} Request already pending`);
    }

    if (this.portOrProcess instanceof SerialPort) {
      this.portOrProcess.write(command + '\n');
      this.portOrProcess.drain();
    } else {
      this.portOrProcess.stdin.write(command + '\n');
    }

    return new Promise((resolve, reject) => {
      this.pendingPromise = { resolve, reject };

      this.timeoutHandle = setTimeout(() => {
        if (this.pendingPromise) {
          this.pendingPromise.reject(new Error(`${this.name} Timeout waiting for response`));
          this.pendingPromise = null;
        }
      }, timeoutMs);
    });
  }
}