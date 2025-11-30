import { servoConfig, ServoMiddle } from './types';

// Native addon for PyTorch inference
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/JSClang.node') as {
  loadModel: (path: string) => void;
  runModel: (input: number[]) => number[];
};

/**
 * Policy index to servo ID mapping.
 * Order matches URDF traversal with preserve_order=True.
 */
export const POLICY_TO_SERVO: number[] = [
  1,   // 0: SHOULDER_MAIN_R (base_link_to_shoulder_joint_v1_revolute)
  2,   // 1: SHOULDER_MAIN_L (base_link_to_shoulder_joint_v1Mirror_revolute)
  9,   // 2: HIP_ROTATE_R (base_link_to_RightHipBracket_revolute)
  10,  // 3: HIP_ROTATE_L (base_link_to_LeftHipBracket_revolute)
  12,  // 4: HIP_TILT_L (LeftHipBracket_to_HipBulkL_revolute)
  11,  // 5: HIP_TILT_R (RightHipBracket_to_HipBulkR_revolute)
  14,  // 6: HIP_MAIN_L (HipBulkL_to_HipL_revolute)
  13,  // 7: HIP_MAIN_R (HipBulkR_to_HipR_revolute)
  16,  // 8: KNEE_L (HipL_to_TibiaL_revolute)
  15,  // 9: KNEE_R (HipR_to_TibiaR_revolute)
  17,  // 10: FOOT_MAIN_R (TibiaR_to_FootJointR_revolute)
  18,  // 11: FOOT_MAIN_L (TibiaL_to_FootJointL_revolute)
  20,  // 12: FOOT_TILT_L (FootJointL_to_LeftFoot_revolute)
  19,  // 13: FOOT_TILT_R (FootJointR_to_RightFoot_revolute)
];

/**
 * Reverse mapping: servo ID to policy index.
 */
export const SERVO_TO_POLICY: Map<number, number> = new Map(
  POLICY_TO_SERVO.map((servoId, policyIdx) => [servoId, policyIdx])
);

/**
 * Joint limits from URDF (radians). [min, max] per policy index.
 */
export const JOINT_LIMITS: [number, number][] = [
  [-1.57, 3.14],   // 0: shoulder_v1
  [-3.14, 1.57],   // 1: shoulder_v1Mirror
  [-0.61, 0.61],   // 2: RightHipBracket
  [-0.61, 0.61],   // 3: LeftHipBracket
  [-0.44, 0.44],   // 4: HipBulkL
  [-0.44, 0.44],   // 5: HipBulkR
  [-1.57, 0.79],   // 6: HipL
  [-0.61, 1.57],   // 7: HipR
  [0.0, 1.92],     // 8: TibiaL (knee L)
  [-1.92, 0.0],    // 9: TibiaR (knee R)
  [-1.48, 0.79],   // 10: FootJointR
  [-1.48, 0.79],   // 11: FootJointL
  [-0.35, 0.35],   // 12: LeftFoot
  [-0.35, 0.35],   // 13: RightFoot
];

const NUM_JOINTS = 14;
const OBS_SIZE = 40;

/**
 * Sign flip to convert URDF convention → physical servo convention.
 * 
 * Empirically determined by testing each joint individually.
 * If joint moves OPPOSITE to expected, flip the sign here.
 * 
 * Verified joints (user tested 2024-11):
 * - Reversed from initial: 0, 1, 2, 3, 6, 7, 10, 11
 */
const POLICY_SIGN_FLIP: number[] = [
  -1,  // 0: SHOULDER_MAIN_R - VERIFIED: was +1, reversed
  +1,  // 1: SHOULDER_MAIN_L - VERIFIED: was -1, reversed
  -1,  // 2: HIP_ROTATE_R - VERIFIED: was +1, reversed
  -1,  // 3: HIP_ROTATE_L - VERIFIED: was +1, reversed
  +1,  // 4: HIP_TILT_L - unchanged
  -1,  // 5: HIP_TILT_R - unchanged
  +1,  // 6: HIP_MAIN_L - VERIFIED: was -1, reversed
  -1,  // 7: HIP_MAIN_R - VERIFIED: was +1, reversed
  +1,  // 8: KNEE_L - symmetric convention (both knees positive when bent)
  -1,  // 9: KNEE_R - symmetric convention (both knees positive when bent)
  -1,  // 10: FOOT_MAIN_R - VERIFIED: was +1, reversed
  +1,  // 11: FOOT_MAIN_L - VERIFIED: was -1, reversed
  -1,  // 12: FOOT_TILT_L - VERIFIED: was +1, reversed (outer→inner edge)
  -1,  // 13: FOOT_TILT_R - VERIFIED: was +1, reversed (outer→inner edge)
];

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
  -1.57,  // 0: SHOULDER_MAIN_R - offset so action=0 → servo 3072 (arms down)
  +1.57,  // 1: SHOULDER_MAIN_L - offset so action=0 → servo 1024 (arms down)
  0,      // 2: HIP_ROTATE_R
  0,      // 3: HIP_ROTATE_L
  0,      // 4: HIP_TILT_L
  0,      // 5: HIP_TILT_R
  0,      // 6: HIP_MAIN_L
  0,      // 7: HIP_MAIN_R
  0,      // 8: KNEE_L
  0,      // 9: KNEE_R
  0,      // 10: FOOT_MAIN_R
  0,      // 11: FOOT_MAIN_L
  0,      // 12: FOOT_TILT_L
  0,      // 13: FOOT_TILT_R
];

// Servo steps per radian: (4095 - 0) / (2 * PI) ≈ 651.9
const STEPS_PER_RAD = 4095 / (2 * Math.PI);

export type IMUData = {
  quat: number[];      // [qw, qx, qy, qz] or [qx, qy, qz, qw] - check your IMU
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
export function computeProjectedGravity(quat: number[]): [number, number, number] {
  // IMU outputs scalar-last: [qx, qy, qz, qw]
  const qx = quat[0] ?? 0;
  const qy = quat[1] ?? 0;
  const qz = quat[2] ?? 0;
  const qw = quat[3] ?? 1;
  const gx = 2 * (qx * qz - qw * qy);
  const gy = 2 * (qy * qz + qw * qx);
  const gz = 1 - 2 * (qx * qx + qy * qy);
  return [gx, gy, -gz];
}

export class PolicyRunner {
  private lastAction: number[] = new Array(NUM_JOINTS).fill(0);
  private modelLoaded = false;

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
    return config.direction * (servoPos - ServoMiddle) / STEPS_PER_RAD;
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
        console.warn(`[PolicyRunner] Missing servo position for ID ${servoId}, using 2048`);
        jointPos.push(0);
      } else {
        // Convert servo → symmetric radians, then apply flip to get URDF convention
        const symmetricRad = this.servoToRad(servoPos, servoId);
        jointPos.push(symmetricRad * POLICY_SIGN_FLIP[i]!);
      }
    }
    return jointPos;
  }

  /**
   * Convert servo velocities to joint velocities in URDF convention.
   * Uses servo's built-in velocity feedback (cleaner than differentiation).
   * 
   * @param servoSpeeds Record<servoId, speed> in servo units/second
   * @returns Joint velocities in rad/s, URDF convention
   */
  extractJointVelocities(servoSpeeds: Record<number, number>): number[] {
    const jointVel: number[] = [];
    for (let i = 0; i < NUM_JOINTS; i++) {
      const servoId = POLICY_TO_SERVO[i]!;
      const servoSpeed = servoSpeeds[servoId];
      if (servoSpeed === undefined) {
        jointVel.push(0);
      } else {
        // Convert servo speed to rad/s, applying direction and sign flip
        // Same transform as positions: servo → symmetric → URDF
        const config = servoConfig[servoId];
        const symmetricVel = config!.direction * servoSpeed / STEPS_PER_RAD;
        jointVel.push(symmetricVel * POLICY_SIGN_FLIP[i]!);
      }
    }
    return jointVel;
  }

  /**
   * Build the 54-element observation vector.
   */
  buildObservation(
    imu: IMUData,
    servoPositions: Record<number, number>,
    // servoSpeeds: Record<number, number>,  // commented out - policy trained without velocity observations
    cmdVel: [number, number, number], // [vx, vy, wz]
  ): number[] {
    const jointPos = this.extractJointPositions(servoPositions);
    // const jointVel = this.extractJointVelocities(servoSpeeds);
    const jointVel = new Array(NUM_JOINTS).fill(0);  // policy trained without velocity observations

    // Joint positions relative to default
    // DEFAULT_JOINT_POS represents where servo 2048 is in URDF space
    const jointPosRel = jointPos.map((pos, i) => pos - DEFAULT_JOINT_POS[i]!);

    // Compute projected gravity from quaternion (more reliable than IMU's gravVector)
    const projectedGravity = computeProjectedGravity(imu.quat);

    // Unit conversions for IMU data:
    // - Accelerometer: IMU outputs g's, policy expects m/s²
    // - Gyroscope: IMU outputs deg/s, policy expects rad/s
    const G_TO_MS2 = 9.81;
    const DEG_TO_RAD = Math.PI / 180;

    const obs: number[] = [
      // Base linear acceleration (3) - converted from g to m/s²
      imu.acc[0]! * G_TO_MS2, imu.acc[1]! * G_TO_MS2, imu.acc[2]! * G_TO_MS2,
      // Base angular velocity (3) - converted from deg/s to rad/s
      imu.gyro[0]! * DEG_TO_RAD, imu.gyro[1]! * DEG_TO_RAD, imu.gyro[2]! * DEG_TO_RAD,
      // Projected gravity (3) - computed from quaternion
      projectedGravity[0], projectedGravity[1], projectedGravity[2],
      // Velocity commands (3)
      cmdVel[0], cmdVel[1], cmdVel[2],
      // Joint positions relative to default (14)
      ...jointPosRel,
      // Joint velocities (14)
      // ...jointVel,
      // Previous actions (14)
      ...this.lastAction,
    ];

    if (obs.length !== OBS_SIZE) {
      throw new Error(`Observation size mismatch: expected ${OBS_SIZE}, got ${obs.length}`);
    }

    return obs;
  }

  /**
   * Run policy inference and return actions.
   */
  step(obs: number[]): number[] {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    const rawActions = addon.runModel(obs);

    // Clip to [-1, 1]
    const actions = rawActions.map(a => Math.max(-1, Math.min(1, a)));

    // Store for next observation
    this.lastAction = actions.slice();

    return actions;
  }

  /**
   * Convert policy actions to target joint positions in radians.
   * Applies DEFAULT_JOINT_POS offset and POLICY_SIGN_FLIP.
   */
  actionsToRadians(actions: number[]): number[] {
    const targetRad: number[] = [];
    for (let i = 0; i < NUM_JOINTS; i++) {
      // Target position = default + action (action scale is 1.0)
      let rad = DEFAULT_JOINT_POS[i]! + actions[i]! * 1.0;

      // Convert URDF convention → symmetric servo convention
      rad = rad * POLICY_SIGN_FLIP[i]!;

      targetRad.push(rad);
    }
    return targetRad;
  }

  /**
   * Convert actions to servo position commands.
   * Returns a Record<servoId, position> suitable for backboneController.setPos().
   */
  actionsToServoPositions(actions: number[]): Record<number, number> {
    const targetRad = this.actionsToRadians(actions);
    const servoTargets: Record<number, number> = {};

    for (let i = 0; i < NUM_JOINTS; i++) {
      const servoId = POLICY_TO_SERVO[i]!;
      const servoPos = this.radToServo(targetRad[i]!, servoId);

      // Clamp to valid servo range
      servoTargets[servoId] = Math.max(0, Math.min(4095, servoPos));
    }

    return servoTargets;
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
    this.lastAction = new Array(NUM_JOINTS).fill(0);
  }
}
