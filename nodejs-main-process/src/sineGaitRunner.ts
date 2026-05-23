import {servoConfig, ServoIDs, ServoMiddle} from './types';

const GAIT_FREQ = 2.0;
const SOFT_LIMIT_FACTOR = 0.9;

const JOINT_LIMITS: [number, number][] = [
  [-0.61, 0.61], // 1: RightHipBracket (HIP_ROTATE_R)
  [-0.44, 0.44], // 5: HipBulkR (HIP_TILT_R)
  [-0.61, 1.57], // 7: HipR (HIP_MAIN_R)
  [-1.92, -0.8], // 9: TibiaR (KNEE_R)
  [-0.35, 0.35], // 13: RightFoot (FOOT_TILT_R)
];

const RIGHT_SERVOS = [
  ServoIDs.HIP_ROTATE_R,
  ServoIDs.HIP_TILT_R,
  ServoIDs.HIP_MAIN_R,
  ServoIDs.KNEE_R,
  ServoIDs.FOOT_TILT_R,
];

const LEFT_SERVOS = [
  ServoIDs.HIP_ROTATE_L,
  ServoIDs.HIP_TILT_L,
  ServoIDs.HIP_MAIN_L,
  ServoIDs.KNEE_L,
  ServoIDs.FOOT_TILT_L,
];

const MIRRORED_OFFSETS = [false, true, false, false, true];

const MIRRORED_AMPLITUDES = [
  false, // HIP_ROTATE_R
  true, // HIP_TILT_R
  false, // HIP_MAIN_R
  false, // KNEE_R
  true, // FOOT_TILT_R
];

const AMPLITUDES = [
  0.0, // HIP_ROTATE_R
  0.1, // HIP_TILT_R
  0.1, // 0.15, // HIP_MAIN_R
  0.2, // 0.3, // KNEE_R
  0.1, // FOOT_TILT_R
];

const OFFSETS = [
  0.0, // HIP_ROTATE_R
  -0.2, // HIP_TILT_R
  0.35, // HIP_MAIN_R
  -0.8, // KNEE_R
  0.1, // FOOT_TILT_R
];

const FOOT_OFFSET = 0.0;

const PHASE_OFFSETS = [
  0, // HIP_ROTATE_R
  0, // HIP_TILT_R
  -Math.PI / 2, // HIP_MAIN_R
  Math.PI, // KNEE_R
  Math.PI, // FOOT_TILT_R
];

const START_TIME = [
  (1 / GAIT_FREQ) * 0.0, // HIP_ROTATE_R
  (1 / GAIT_FREQ) * 0.0, // HIP_TILT_R
  (1 / GAIT_FREQ) * 1.25, // HIP_MAIN_R
  (1 / GAIT_FREQ) * 1.0, // KNEE_R
  (1 / GAIT_FREQ) * 0.0, // FOOT_TILT_R
];

const STEPS_PER_RAD = 4095 / (2 * Math.PI);

export class SineGaitRunner {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  reset(): void {
    this.startTime = Date.now();
  }

  private radToServo(rad: number, servoId: number): number {
    const config = servoConfig[servoId];
    if (!config) throw new Error(`Unknown servo ID: ${servoId}`);
    return Math.round(
      ServoMiddle + config.direction * rad * STEPS_PER_RAD + config.offset,
    );
  }

  step(): Record<number, number> {
    const t = (Date.now() - this.startTime) / 1000; // seconds
    const phase = 2 * Math.PI * GAIT_FREQ * t;

    const servoTargetsRad = RIGHT_SERVOS.reduce(
      (acc, _, i) => {
        const amplitude = AMPLITUDES[i]!;
        const offset = OFFSETS[i]!;
        const phaseOffset = PHASE_OFFSETS[i]!;
        const startTime = START_TIME[i]!;
        const hasStarted = t >= startTime ? 1 : 0;
        const servoTargetRadRight =
          amplitude * hasStarted * Math.sin(phase + phaseOffset) + offset;
        const servoTargetRadLeft =
          (MIRRORED_AMPLITUDES[i] ? amplitude : -amplitude) *
            hasStarted *
            Math.sin(phase + phaseOffset + Math.PI) -
          (MIRRORED_OFFSETS[i] ? -offset : offset);

        const [lo, hi] = JOINT_LIMITS[i]!;
        const softLimitOffset =
          (Math.abs(hi - lo) * (1 - SOFT_LIMIT_FACTOR)) / 2;
        const clippedServoTargetRadRight = Math.max(
          lo + softLimitOffset,
          Math.min(hi - softLimitOffset, servoTargetRadRight),
        );
        const clippedServoTargetRadLeft = Math.max(
          -hi + softLimitOffset,
          Math.min(-lo - softLimitOffset, servoTargetRadLeft),
        );

        acc[RIGHT_SERVOS[i]!] = clippedServoTargetRadRight;

        acc[LEFT_SERVOS[i]!] = clippedServoTargetRadLeft;

        return acc;
      },
      {} as Record<number, number>,
    );

    const footRightTargetRad =
      servoTargetsRad[ServoIDs.HIP_MAIN_R]! + servoTargetsRad[ServoIDs.KNEE_R]!;
    const footLeftTargetRad =
      -servoTargetsRad[ServoIDs.HIP_MAIN_L]! -
      servoTargetsRad[ServoIDs.KNEE_L]!;

    servoTargetsRad[ServoIDs.FOOT_MAIN_R] = footRightTargetRad + FOOT_OFFSET;
    servoTargetsRad[ServoIDs.FOOT_MAIN_L] = footLeftTargetRad + FOOT_OFFSET;

    const servoTargets = Object.keys(servoTargetsRad).reduce(
      (acc, servoIdStr) => {
        const servoId = parseInt(servoIdStr);
        acc[servoId] = this.radToServo(servoTargetsRad[servoId]!, servoId);
        return acc;
      },
      {} as Record<number, number>,
    );

    return servoTargets;
  }
}
