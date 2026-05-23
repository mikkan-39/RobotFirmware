import {servoConfig, ServoMiddle} from './types';

// Native addon for PyTorch inference
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/JSClang.node') as {
  loadModel: (path: string) => void;
  runModel: (input: number[]) => number[];
};

/*
Joint order and directions verified through training environment.
  name, action index, action direction, observation index and direction is the same as in action space for all tested joints

  base_link_to_LeftHipBracket_revolute, 0, + is inward 
  base_link_to_RightHipBracket_revolute, 1, + is outward 
  base_link_to_shoulder_joint_v1Mirror_revolute (left shoulder), 2, + is backward 
  base_link_to_shoulder_joint_v1_revolute (right shoulder), 3, + is forward 
  LeftHipBracket_to_HipBulkL_revolute, 4, + is inward 
  RightHipBracket_to_HipBulkR_revolute, 5, + is inward 
  HipBulkL_to_HipL_revolute, 6, + is backward 
  HipBulkR_to_HipR_revolute, 7, + is forward 
  HipL_to_TibiaL_revolute, 8, + is bend 
  HipR_to_TibiaR_revolute, 9, - is bend 
  TibiaL_to_FootJointL_revolute, 10, - is toe up 
  TibiaR_to_FootJointR_revolute, 11, - is toe up 
  FootJointL_to_LeftFoot_revolute, 12, + is foot inward 
  FootJointR_to_RightFoot_revolute, 13, + is foot inward
*/

/**
 * Policy index to servo ID mapping.
 * Order matches training environment (verified via Isaac Lab).
 */
export const POLICY_TO_SERVO: number[] = [
  10, // 0: HIP_ROTATE_L (base_link_to_LeftHipBracket_revolute)
  9, // 1: HIP_ROTATE_R (base_link_to_RightHipBracket_revolute)
  2, // 2: SHOULDER_MAIN_L (base_link_to_shoulder_joint_v1Mirror_revolute)
  1, // 3: SHOULDER_MAIN_R (base_link_to_shoulder_joint_v1_revolute)
  12, // 4: HIP_TILT_L (LeftHipBracket_to_HipBulkL_revolute)
  11, // 5: HIP_TILT_R (RightHipBracket_to_HipBulkR_revolute)
  14, // 6: HIP_MAIN_L (HipBulkL_to_HipL_revolute)
  13, // 7: HIP_MAIN_R (HipBulkR_to_HipR_revolute)
  16, // 8: KNEE_L (HipL_to_TibiaL_revolute)
  15, // 9: KNEE_R (HipR_to_TibiaR_revolute)
  18, // 10: FOOT_MAIN_L (TibiaL_to_FootJointL_revolute)
  17, // 11: FOOT_MAIN_R (TibiaR_to_FootJointR_revolute)
  20, // 12: FOOT_TILT_L (FootJointL_to_LeftFoot_revolute)
  19, // 13: FOOT_TILT_R (FootJointR_to_RightFoot_revolute)
];

const SERVO_NAMES = [
  'HIP_ROTATE_L',
  'HIP_ROTATE_R',
  'SHOULDER_MAIN_L',
  'SHOULDER_MAIN_R',
  'HIP_TILT_L',
  'HIP_TILT_R',
  'HIP_MAIN_L',
  'HIP_MAIN_R',
  'KNEE_L',
  'KNEE_R',
  'FOOT_MAIN_L',
  'FOOT_MAIN_R',
  'FOOT_TILT_L',
  'FOOT_TILT_R',
];

/**
 * Reverse mapping: servo ID to policy index.
 */
export const SERVO_TO_POLICY: Map<number, number> = new Map(
  POLICY_TO_SERVO.map((servoId, policyIdx) => [servoId, policyIdx]),
);

/**
 * Joint limits from URDF (radians). [min, max] per policy index.
 * Order matches training environment (same as POLICY_TO_SERVO).
 */
export const JOINT_LIMITS: [number, number][] = [
  [-0.61, 0.61], // 0: LeftHipBracket (HIP_ROTATE_L)
  [-0.61, 0.61], // 1: RightHipBracket (HIP_ROTATE_R)
  [-3.14, 1.57], // 2: shoulder_v1Mirror (SHOULDER_MAIN_L)
  [-1.57, 3.14], // 3: shoulder_v1 (SHOULDER_MAIN_R)
  [-0.44, 0.44], // 4: HipBulkL (HIP_TILT_L)
  [-0.44, 0.44], // 5: HipBulkR (HIP_TILT_R)
  [-1.57, 0.79], // 6: HipL (HIP_MAIN_L)
  [-0.61, 1.57], // 7: HipR (HIP_MAIN_R)
  [0.0, 1.92], // 8: TibiaL (KNEE_L)
  [-1.92, 0.0], // 9: TibiaR (KNEE_R)
  [-1.48, 0.79], // 10: FootJointL (FOOT_MAIN_L)
  [-1.48, 0.79], // 11: FootJointR (FOOT_MAIN_R)
  [-0.35, 0.35], // 12: LeftFoot (FOOT_TILT_L)
  [-0.35, 0.35], // 13: RightFoot (FOOT_TILT_R)
];

/**
 * Sign flip to convert URDF convention → physical servo convention.
 *
 * Empirically determined by testing each joint individually.
 * If joint moves OPPOSITE to expected, flip the sign here.
 *
 * Verified joints (user tested 2024-11):
 * - Reversed from initial: 0, 1, 2, 3, 6, 7, 10, 11
 */
// const POLICY_SIGN_FLIP: number[] = [
//   +1, // 0: HIP_ROTATE_L - verified
//   -1, // 1: HIP_ROTATE_R - verified
//   +1, // 2: SHOULDER_MAIN_L - verified
//   -1, // 3: SHOULDER_MAIN_R - verified
//   -1, // 4: HIP_TILT_L - verified
//   -1, // 5: HIP_TILT_R - verified
//   +1, // 6: HIP_MAIN_L - verified
//   -1, // 7: HIP_MAIN_R - verified
//   +1, // 8: KNEE_L - verified
//   -1, // 9: KNEE_R - verified
//   +1, // 10: FOOT_MAIN_L - verified
//   +1, // 11: FOOT_MAIN_R - verified
//   +1, // 12: FOOT_TILT_L - verified
//   +1, // 13: FOOT_TILT_R - verified
// ];

/**
 * Default joint positions in URDF convention (radians).
 *
 * This represents the URDF position that corresponds to servo 2048 (mechanical neutral).
 * Used to offset between mechanical neutral and URDF neutral.
 *
 * For most joints: servo 2048 = URDF 0 (no offset needed)
 * For shoulders: servo 2048 = arms forward = URDF ±1.57 rad (90° offset)
 */
const DEFAULT_JOINT_POS: number[] = [
  0, // 0: HIP_ROTATE_L
  0, // 1: HIP_ROTATE_R
  +1.57, // 2: SHOULDER_MAIN_L - offset so action=0 → servo 1024 (arms down)
  -1.57, // 3: SHOULDER_MAIN_R - offset so action=0 → servo 3072 (arms down)
  0, // 4: HIP_TILT_L
  0, // 5: HIP_TILT_R
  0, // 6: HIP_MAIN_L
  0, // 7: HIP_MAIN_R
  0, // 8: KNEE_L
  0, // 9: KNEE_R
  0, // 10: FOOT_MAIN_L
  0, // 11: FOOT_MAIN_R
  0, // 12: FOOT_TILT_L
  0, // 13: FOOT_TILT_R
];

// Servo steps per radian: (4095 - 0) / (2 * PI) ≈ 651.9
const STEPS_PER_RAD = 4095 / (2 * Math.PI);

// Low-pass filter alpha for IMU data (0-1)
// 0 = no filtering (use previous), 1 = no filtering (use raw), ~0.2 = heavy smoothing
const IMU_FILTER_ALPHA = 0.4; // Set to 1.0 to disable filtering

// Gait phase frequency (Hz)
const GAIT_PHASE_FREQ = 1.5;

const NUM_JOINTS = 14;
/** Previous raw (unclipped) policy outputs in observation (one frame). */
const PREV_ACTION_SIZE = 14;
// OBS:  3 gravity + 3 velocity command + 2 gait + 14 joint pos (rel.) + 14 prev actions
const OBS_SIZE = 3 + 3 + 2 + NUM_JOINTS + PREV_ACTION_SIZE;

/**
 * Clip bound on raw policy output before DELTA_SCALE (symmetric: [-CLIP_MAGNITUDE, +CLIP_MAGNITUDE]).
 */
const CLIP_MAGNITUDE = 1.0;

/**
 * radians per step: integrated target offset += clip(policy_out) * DELTA_SCALE
 */
const DELTA_SCALE = 0.1;

/**
 * Soft limit factor for joint limits.
 */
const SOFT_LIMIT_FACTOR = 0.9;

// Debug logging flag - set to true to enable detailed logging to file
export const POLICY_DEBUG_LOGGING = false;

export type IMUData = {
  quat: number[]; // [qw, qx, qy, qz] or [qx, qy, qz, qw] - check your IMU
  gravVector: number[]; // May be unreliable - we compute our own
  acc: number[];
  gyro: number[];
};

/**
 * Compute projected gravity from quaternion.
 * Rotates world gravity [0, 0, -1] into body frame.
 *
 * @param quat Quaternion [qx, qy, qz, qw] (scalar-last, as output by IMU)
 * @returns Unit vector [gx, gy, gz] in body frame
 */
export function computeProjectedGravity(
  quat: number[],
): [number, number, number] {
  // IMU outputs scalar-last: [qx, qy, qz, qw]
  const qx = quat[0] ?? 0;
  const qy = quat[1] ?? 0;
  const qz = quat[2] ?? 0;
  const qw = quat[3] ?? 1;
  const gx = 2 * (qx * qz - qw * qy);
  const gy = 2 * (qy * qz + qw * qx);
  const gz = 1 - 2 * (qx * qx + qy * qy);
  // IMU is rotated 180° around Z relative to sim body frame
  // So negate both gx and gy
  return [-gx, -gy, -gz];
}

export class PolicyRunner {
  /** Raw (unclipped) policy output from the previous step (for next observation). */
  private previousAction: number[] = new Array(NUM_JOINTS).fill(0);

  /** Cumulative offset from DEFAULT_JOINT_POS (URDF rad); integrated from deltas. */
  private integratedOffset: number[] = new Array(NUM_JOINTS).fill(0);

  private modelLoaded = false;

  // Gait phase start time (for sine/cosine clock)
  private gaitPhaseStartTime: number | null = null;

  // Filtered IMU values (for low-pass filtering)
  private filteredAcc: number[] | null = null;
  private filteredGyro: number[] | null = null;

  // Raw policy output (before clipping/smoothing) for debugging
  private lastRawActions: number[] = new Array(NUM_JOINTS).fill(0);

  constructor(modelPath: string) {
    addon.loadModel(modelPath);
    this.modelLoaded = true;
    console.log(`[PolicyRunner] Model loaded from ${modelPath}`);
  }

  /**
   * Convert servo position (0-4095) to radians, accounting for direction.
   */
  servoToRad(servoPos: number, servoId: number): number {
    const config = servoConfig[servoId];
    if (!config) throw new Error(`Unknown servo ID: ${servoId}`);
    return (config.direction * (servoPos - ServoMiddle)) / STEPS_PER_RAD;
  }

  /**
   * Convert radians to servo position (0-4095), accounting for direction.
   */
  radToServo(rad: number, servoId: number): number {
    const config = servoConfig[servoId];
    if (!config) throw new Error(`Unknown servo ID: ${servoId}`);
    return Math.round(ServoMiddle + config.direction * rad * STEPS_PER_RAD);
  }

  /**
   * Extract joint positions in policy order from servo position map.
   * Applies POLICY_SIGN_FLIP to convert from symmetric servo convention to URDF convention.
   */
  extractJointPositions(servoPositions: Record<number, number>): number[] {
    const jointPos: number[] = [];
    for (let i = 0; i < NUM_JOINTS; i++) {
      const servoId = POLICY_TO_SERVO[i]!;
      const servoPos = servoPositions[servoId];
      if (servoPos === undefined) {
        console.warn(
          `[PolicyRunner] Missing servo position for ID ${servoId}, using 2048`,
        );
        jointPos.push(0);
      } else {
        // Convert servo → symmetric radians, then apply flip to get URDF convention
        const symmetricRad = this.servoToRad(servoPos, servoId);
        // jointPos.push(symmetricRad * POLICY_SIGN_FLIP[i]!);
        jointPos.push(symmetricRad);
      }
    }
    return jointPos;
  }

  /**
   * Build the observation vector.
   */
  buildObservation(
    imu: IMUData,
    servoPositions: Record<number, number>,
    cmdVel: [number, number, number], // [vx, vy, wz]
  ): number[] {
    const jointPos = this.extractJointPositions(servoPositions);
    // Joint positions relative to default (URDF); DEFAULT_JOINT_POS = servo 2048 pose
    const jointPosRel = jointPos.map((pos, i) => pos - DEFAULT_JOINT_POS[i]!);

    //FIXME
    // jointPosRel[0] = 0;
    // jointPosRel[1] = 0;
    jointPosRel[2] = 0;
    jointPosRel[3] = 0;
    // jointPosRel[4] = 0;
    // jointPosRel[5] = 0;
    // jointPosRel[6] = 0;
    // jointPosRel[7] = 0;
    // jointPosRel[8] = 0;
    // jointPosRel[9] = 0;
    // jointPosRel[10] = 0;
    // jointPosRel[11] = 0;
    // jointPosRel[12] = 0;
    // jointPosRel[13] = 0;

    // Compute projected gravity from quaternion (more reliable than IMU's gravVector)
    const projectedGravity = computeProjectedGravity(imu.quat);

    // Unit conversions for IMU data:
    // - Accelerometer: IMU outputs g's, policy expects m/s²
    // - Gyroscope: IMU outputs deg/s, policy expects rad/s
    // const G_TO_MS2 = 9.81;
    // const DEG_TO_RAD = Math.PI / 180;

    // Convert raw IMU to policy units
    // const rawAcc = [
    //   imu.acc[0]! * G_TO_MS2,
    //   imu.acc[1]! * G_TO_MS2,
    //   imu.acc[2]! * G_TO_MS2,
    // ];
    // const rawGyro = [
    //   imu.gyro[0]! * DEG_TO_RAD,
    //   imu.gyro[1]! * DEG_TO_RAD,
    //   imu.gyro[2]! * DEG_TO_RAD,
    // ];

    // Apply low-pass filter (set IMU_FILTER_ALPHA=1.0 to disable)
    // if (this.filteredAcc === null) {
    //   this.filteredAcc = rawAcc;
    //   this.filteredGyro = rawGyro;
    // } else {
    //   for (let i = 0; i < 3; i++) {
    //     this.filteredAcc[i] =
    //       IMU_FILTER_ALPHA * rawAcc[i]! +
    //       (1 - IMU_FILTER_ALPHA) * this.filteredAcc[i]!;
    //     this.filteredGyro![i] =
    //       IMU_FILTER_ALPHA * rawGyro[i]! +
    //       (1 - IMU_FILTER_ALPHA) * this.filteredGyro![i]!;
    //   }
    // }

    // Gait phase (sine/cosine clock)
    if (this.gaitPhaseStartTime === null) {
      this.gaitPhaseStartTime = Date.now();
    }
    const t = (Date.now() - this.gaitPhaseStartTime) / 1000; // seconds
    const phase = 2 * Math.PI * GAIT_PHASE_FREQ * t;
    const gaitPhaseSin = Math.sin(phase);
    const gaitPhaseCos = Math.cos(phase);

    const obs: number[] = [
      // Base linear acceleration (3) - filtered
      // this.filteredAcc[0]!,
      // this.filteredAcc[1]!,
      // this.filteredAcc[2]!,
      // Base angular velocity (3) - filtered
      // this.filteredGyro![0]!,
      // this.filteredGyro![1]!,
      // this.filteredGyro![2]!,
      // Projected gravity (3) - computed from quaternion
      projectedGravity[0],
      projectedGravity[1],
      projectedGravity[2],
      // Velocity commands (3)
      cmdVel[0],
      cmdVel[1],
      cmdVel[2],
      // // Gait phase (2) - sine and cosine
      gaitPhaseSin,
      gaitPhaseCos,
      ...jointPosRel,
      ...this.previousAction,
    ];

    if (obs.length !== OBS_SIZE) {
      throw new Error(
        `Observation size mismatch: expected ${OBS_SIZE}, got ${obs.length}`,
      );
    }

    return obs;
  }

  /**
   * Run policy inference and return actions.
   */
  step(obs: number[]): Record<number, number> {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    const rawActions = addon.runModel(obs);

    //FIXME
    // rawActions[0] = 0;
    // rawActions[1] = 0;
    rawActions[2] = 0;
    rawActions[3] = 0;
    // rawActions[4] = 0;
    // rawActions[5] = 0;
    // rawActions[6] = 0;
    // rawActions[7] = 0;
    // rawActions[8] = 0;
    // rawActions[9] = 0;
    // rawActions[10] = 0;
    // rawActions[11] = 0;
    // rawActions[12] = 0;
    // rawActions[13] = 0;

    // Store raw actions for debugging
    this.lastRawActions = rawActions.slice();

    for (let i = 0; i < NUM_JOINTS; i++) {
      const raw = rawActions[i] ?? 0;
      this.previousAction[i] = raw;
      const clipped = Math.max(-CLIP_MAGNITUDE, Math.min(CLIP_MAGNITUDE, raw));
      const newOffset = (this.integratedOffset[i] ?? 0) + clipped * DELTA_SCALE;
      const [lo, hi] = JOINT_LIMITS[i]!;
      const softLimitOffset = (Math.abs(hi - lo) * (1 - SOFT_LIMIT_FACTOR)) / 2;
      const clippedOffset = Math.max(
        lo + softLimitOffset,
        Math.min(hi - softLimitOffset, newOffset),
      );
      this.integratedOffset[i] = clippedOffset;
    }

    const servoTargets = this.integratedOffset.reduce(
      (acc, curr, i) => {
        console.log({
          name: SERVO_NAMES[i]!,
          i,
          curr,
          servo: this.radToServo(curr, POLICY_TO_SERVO[i]!),
        });

        acc[POLICY_TO_SERVO[i]!] = this.radToServo(curr, POLICY_TO_SERVO[i]!);
        return acc;
      },
      {} as Record<number, number>,
    );

    return servoTargets;
  }

  /**
   * Get the raw policy output from the last step (before clip / integration).
   */
  getLastRawActions(): number[] {
    return this.lastRawActions.slice();
  }

  /**
   * Check if robot is tilted excessively (emergency condition).
   * Returns true if tilt exceeds ~45 degrees from vertical.
   *
   * @param quat Quaternion [qw, qx, qy, qz] from IMU
   */
  checkExcessiveTilt(quat: number[]): boolean {
    const [, , gz] = computeProjectedGravity(quat);
    // gz should be approximately -1 when upright (gravity pointing down)
    // |gz| < 0.7 means >45 degree tilt
    return Math.abs(gz) < 0.7;
  }

  /**
   * Reset internal state (call when starting/stopping policy control).
   */
  reset(): void {
    this.previousAction = new Array(NUM_JOINTS).fill(0);
    this.integratedOffset = new Array(NUM_JOINTS).fill(0);
    this.gaitPhaseStartTime = null;
    this.filteredAcc = null;
    this.filteredGyro = null;
    this.lastRawActions = new Array(NUM_JOINTS).fill(0);
  }
}
