import { writeFile, readFileSync } from 'fs'
import { MasterHandlerState, ServoIDs } from './types'
import { performance } from 'perf_hooks';
import e from 'express';

export const saveJSON = (
  object: Record<string | number, any>,
  path: string,
) => {
  writeFile(path, JSON.stringify(object, null, 2), (err) => {
    if (err) {
      console.error('Error writing file:', err)
    } else {
      console.log('JSON file has been saved.')
    }
  })
}

export const getJSONSync = (path: string): Record<string, any> | null => {
  try {
    const data = readFileSync(path, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading or parsing file:', error)
    return null // Return null in case of error
  }
}

export const sittingPosition = getJSONSync('jsons/sittingPosition.json') ?? {}
export const standingPosition = getJSONSync('jsons/standing.json') ?? {}

export const convertToNumberRecord = <T>(
  obj: Record<string, T>,
): Record<number, T> => {
  const result: Record<number, T> = {}

  Object.keys(obj).forEach((key) => {
    if (obj.hasOwnProperty(key)) {
      const numericKey = Number(key)
      if (!isNaN(numericKey)) {
        result[numericKey] = obj[key] as T
      }
    }
  })

  return result
}

export const comparePositions = (
  currentPosition: Record<number, number>,
  templatePosition: Record<number, number>,
  coefficient: number = 125,
): boolean => {
  let sumOfSquares = 0

  Object.keys(currentPosition).forEach((key) => {
    if (
      currentPosition.hasOwnProperty(key) &&
      templatePosition.hasOwnProperty(key)
    ) {
      const currentValue = currentPosition[Number(key)] as number
      const templateValue = templatePosition[Number(key)] as number

      // Convert from 0-4096 to -10 to 10, for comparing conveniency
      const currentScaled = (currentValue / 4096) * 20 - 10
      const templateScaled = (templateValue / 4096) * 20 - 10

      // Calculate the squared difference
      const difference = currentScaled - templateScaled
      sumOfSquares += difference ** 2
    }
  })

  // Divide the sum of squares by the coefficient
  return sumOfSquares / coefficient < 1
}

export const makeGlobalServoValues = (value: number) => {
  const result: Record<number, number> = {}
  Object.keys(ServoIDs).forEach((id) => {
    result[ServoIDs[id as keyof typeof ServoIDs]] = value
  })
  return result
}

export const makeLegServoValues = (value: number) => {
  const result: Record<number, number> = {}
  const legIds = [
    ServoIDs.HIP_MAIN_R,
    ServoIDs.HIP_TILT_R,
    ServoIDs.HIP_ROTATE_R,
    ServoIDs.KNEE_R,
    ServoIDs.FOOT_MAIN_R,
    ServoIDs.FOOT_TILT_R,

    ServoIDs.HIP_MAIN_L,
    ServoIDs.HIP_TILT_L,
    ServoIDs.HIP_ROTATE_L,
    ServoIDs.KNEE_L,
    ServoIDs.FOOT_MAIN_L,
    ServoIDs.FOOT_TILT_L,
  ]
  legIds.forEach((id) => {
    result[id] = value
  })
  return result
}


export type RunLoopControl = {
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  isRunning: () => boolean;
};

export function createRunLoop(
  targetPeriodMs: number,
  main: () => Promise<void>,
  options?: {
    avgWindowSize?: number;
    logEvery?: number;
    shouldLog?: boolean;
  }
): RunLoopControl {
  const avgWindowSize = options?.avgWindowSize ?? 100;
  const logEvery = options?.logEvery ?? 100;
  let shouldLog = options?.shouldLog ?? true;

  let shouldRun = true;
  let paused = false;
  let lastStart = performance.now();
  const durations: number[] = [];
  let cycleCount = 0;
  let errorCount = 0;

  let resolveStop: (() => void) | null = null;
  const loopPromise = new Promise<void>((resolve) => {
    resolveStop = resolve;
  });

  async function loop() {
    while (shouldRun) {
      if (paused) {
        await new Promise((resolve) => setTimeout(resolve, targetPeriodMs));
        continue;
      }

      lastStart = performance.now();
      const cycleStart = lastStart;

      try {
        await main();
        errorCount = 0;
      } catch (err) {
        if (errorCount < 10) {
          errorCount += 1;
          console.warn(`Warning! main() threw error №${errorCount}: ${err}`)
        } else {
          console.error(`[FATAL ERROR] main() threw ${errorCount} errors in a row, stopping runLoop.`);
          console.error(err);
          shouldRun = false;
          break;
        }
      }

      const cycleEnd = performance.now();
      const duration = cycleEnd - cycleStart;
      durations.push(duration);
      if (durations.length > avgWindowSize) {
        durations.shift();
      }

      const elapsedTotal = performance.now() - cycleStart;
      if (elapsedTotal > targetPeriodMs) {
        console.warn(`[WARNING] Overrun detected: cycle took ${elapsedTotal.toFixed(2)}ms`);
      }

      const remaining = targetPeriodMs - elapsedTotal;
      if (remaining > 0) {
        await new Promise((res) => setTimeout(res, remaining));
      }

      cycleCount++;
      if (cycleCount % logEvery === 0 && shouldLog) {
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        console.log(`[INFO] Average main() duration: ${avg.toFixed(3)}ms over last ${durations.length} cycles`);
      }
    }

    console.log(`[INFO] runLoop exited.`);
    resolveStop?.();
  }

  loop();

  return {
    stop: async () => {
      shouldRun = false;
      await loopPromise;
    },
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    isRunning: () => shouldRun && !paused,
  };
}

type ServoPositions = Record<number, number>;

export function calculateServoSpeeds(
  current: ServoPositions,
  target: ServoPositions,
  durationSec: number
): Record<string, number> {
  const speeds: Record<string, number> = {};

  for (const id in target) {
    const currentPos = current[id];
    if (currentPos === undefined) {
      throw new Error(`Missing current position for servo ID ${id}`);
    }
    if (target[id] === undefined) {
      throw new Error(`Missing target position for servo ID ${id}`);
    }

    const delta = Math.abs(target[id] - currentPos); // now safe
    speeds[id] = Math.round(delta / durationSec);
  }

  return speeds;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const crouchedPosition = {
  "9": 2046,
  "10": 2050,
  "11": 2100,
  "12": 2000,
  "13": 1610,
  "14": 2490,
  "15": 2800,
  "16": 1300,
  "17": 1680,
  "18": 2443,
  "19": 2049,
  "20": 2047
}