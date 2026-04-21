import { servoConfig, ServoMiddle } from './types';

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
  10,  // 0: HIP_ROTATE_L (base_link_to_LeftHipBracket_revolute)
  9,   // 1: HIP_ROTATE_R (base_link_to_RightHipBracket_revolute)
  2,   // 2: SHOULDER_MAIN_L (base_link_to_shoulder_joint_v1Mirror_revolute)
  1,   // 3: SHOULDER_MAIN_R (base_link_to_shoulder_joint_v1_revolute)
  12,  // 4: HIP_TILT_L (LeftHipBracket_to_HipBulkL_revolute)
  11,  // 5: HIP_TILT_R (RightHipBracket_to_HipBulkR_revolute)
  14,  // 6: HIP_MAIN_L (HipBulkL_to_HipL_revolute)
  13,  // 7: HIP_MAIN_R (HipBulkR_to_HipR_revolute)
  16,  // 8: KNEE_L (HipL_to_TibiaL_revolute)
  15,  // 9: KNEE_R (HipR_to_TibiaR_revolute)
  18,  // 10: FOOT_MAIN_L (TibiaL_to_FootJointL_revolute)
  17,  // 11: FOOT_MAIN_R (TibiaR_to_FootJointR_revolute)
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
 * Order matches training environment (same as POLICY_TO_SERVO).
 */
export const JOINT_LIMITS: [number, number][] = [
  [-0.61, 0.61],   // 0: LeftHipBracket (HIP_ROTATE_L)
  [-0.61, 0.61],   // 1: RightHipBracket (HIP_ROTATE_R)
  [-3.14, 1.57],   // 2: shoulder_v1Mirror (SHOULDER_MAIN_L)
  [-1.57, 3.14],   // 3: shoulder_v1 (SHOULDER_MAIN_R)
  [-0.44, 0.44],   // 4: HipBulkL (HIP_TILT_L)
  [-0.44, 0.44],   // 5: HipBulkR (HIP_TILT_R)
  [-1.57, 0.79],   // 6: HipL (HIP_MAIN_L)
  [-0.61, 1.57],   // 7: HipR (HIP_MAIN_R)
  [0.0, 1.92],     // 8: TibiaL (KNEE_L)
  [-1.92, 0.0],    // 9: TibiaR (KNEE_R)
  [-1.48, 0.79],   // 10: FootJointL (FOOT_MAIN_L)
  [-1.48, 0.79],   // 11: FootJointR (FOOT_MAIN_R)
  [-0.35, 0.35],   // 12: LeftFoot (FOOT_TILT_L)
  [-0.35, 0.35],   // 13: RightFoot (FOOT_TILT_R)
];

const NUM_JOINTS = 14;
const ACTION_HISTORY_SIZE = 4;
// OBS: 3 acc + 3 gyro + 3 gravity + 3 cmdVel + 2 gait phase + 14 jointPos + 14 prevJointPos + 14*4 actions = 96
const OBS_SIZE = 98;

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
  +1,  // 0: HIP_ROTATE_L - verified
  -1,  // 1: HIP_ROTATE_R - verified
  +1,  // 2: SHOULDER_MAIN_L - verified
  -1,  // 3: SHOULDER_MAIN_R - verified
  -1,  // 4: HIP_TILT_L - verified
  -1,  // 5: HIP_TILT_R - verified
  +1,  // 6: HIP_MAIN_L - verified
  -1,  // 7: HIP_MAIN_R - verified
  +1,  // 8: KNEE_L - verified
  -1,  // 9: KNEE_R - verified
  +1,  // 10: FOOT_MAIN_L - verified
  +1,  // 11: FOOT_MAIN_R - verified
  +1,  // 12: FOOT_TILT_L - verified
  +1,  // 13: FOOT_TILT_R - verified
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
  0,      // 0: HIP_ROTATE_L
  0,      // 1: HIP_ROTATE_R
  +1.57,  // 2: SHOULDER_MAIN_L - offset so action=0 → servo 1024 (arms down)
  -1.57,  // 3: SHOULDER_MAIN_R - offset so action=0 → servo 3072 (arms down)
  0,      // 4: HIP_TILT_L
  0,      // 5: HIP_TILT_R
  0,      // 6: HIP_MAIN_L
  0,      // 7: HIP_MAIN_R
  0,      // 8: KNEE_L
  0,      // 9: KNEE_R
  0,      // 10: FOOT_MAIN_L
  0,      // 11: FOOT_MAIN_R
  0,      // 12: FOOT_TILT_L
  0,      // 13: FOOT_TILT_R
];

// Servo steps per radian: (4095 - 0) / (2 * PI) ≈ 651.9
const STEPS_PER_RAD = 4095 / (2 * Math.PI);

// Low-pass filter alpha for IMU data (0-1)
// 0 = no filtering (use previous), 1 = no filtering (use raw), ~0.2 = heavy smoothing
const IMU_FILTER_ALPHA = 0.7;  // Set to 1.0 to disable filtering

// Action smoothing alpha (0-1)
// Blends new actions with previous to prevent rapid changes
// 1.0 = no smoothing (raw actions), 0.3 = moderate smoothing
const ACTION_SMOOTH_ALPHA = 1.0;  // Set to 1.0 to disable

// Gait phase frequency (Hz)
const GAIT_PHASE_FREQ = 1.0;

// Debug logging flag - set to true to enable detailed logging to file
export const POLICY_DEBUG_LOGGING = true;

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
  // IMU is rotated 180° around Z relative to sim body frame
  // So negate both gx and gy
  return [-gx, -gy, -gz];
}

export class PolicyRunner {
  // Action history: [0]=most recent, [1]=second most recent, etc.
  // Each entry is an array of NUM_JOINTS actions
  private actionHistory: number[][] = Array.from(
    { length: ACTION_HISTORY_SIZE },
    () => new Array(NUM_JOINTS).fill(0)
  );
  private modelLoaded = false;
  
  // Previous joint positions (from last tick)
  private prevJointPos: number[] | null = null;
  
  // Gait phase start time (for sine/cosine clock)
  private gaitPhaseStartTime: number | null = null;
  
  // Filtered IMU values (for low-pass filtering)
  private filteredAcc: number[] | null = null;
  private filteredGyro: number[] | null = null;
  
  // Smoothed actions (for action smoothing)
  private smoothedAction: number[] | null = null;
  
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
   * Build the observation vector.
   */
  buildObservation(
    imu: IMUData,
    servoPositions: Record<number, number>,
    cmdVel: [number, number, number], // [vx, vy, wz]
  ): number[] {
    const jointPos = this.extractJointPositions(servoPositions);

    // Joint positions relative to default
    // DEFAULT_JOINT_POS represents where servo 2048 is in URDF space
    const jointPosRel = jointPos.map((pos, i) => pos - DEFAULT_JOINT_POS[i]!);
    
    // Previous joint positions (use current if first tick)
    const prevJointPosRel = this.prevJointPos 
      ? this.prevJointPos.map((pos, i) => pos - DEFAULT_JOINT_POS[i]!)
      : jointPosRel;
    
    // Store current for next tick
    this.prevJointPos = jointPos.slice();

    // Compute projected gravity from quaternion (more reliable than IMU's gravVector)
    const projectedGravity = computeProjectedGravity(imu.quat);

    // Unit conversions for IMU data:
    // - Accelerometer: IMU outputs g's, policy expects m/s²
    // - Gyroscope: IMU outputs deg/s, policy expects rad/s
    const G_TO_MS2 = 9.81;
    const DEG_TO_RAD = Math.PI / 180;

    // Convert raw IMU to policy units
    const rawAcc = [
      imu.acc[0]! * G_TO_MS2,
      imu.acc[1]! * G_TO_MS2,
      imu.acc[2]! * G_TO_MS2,
    ];
    const rawGyro = [
      imu.gyro[0]! * DEG_TO_RAD,
      imu.gyro[1]! * DEG_TO_RAD,
      imu.gyro[2]! * DEG_TO_RAD,
    ];

    // Apply low-pass filter (set IMU_FILTER_ALPHA=1.0 to disable)
    if (this.filteredAcc === null) {
      this.filteredAcc = rawAcc;
      this.filteredGyro = rawGyro;
    } else {
      for (let i = 0; i < 3; i++) {
        this.filteredAcc[i] = IMU_FILTER_ALPHA * rawAcc[i]! + (1 - IMU_FILTER_ALPHA) * this.filteredAcc[i]!;
        this.filteredGyro![i] = IMU_FILTER_ALPHA * rawGyro[i]! + (1 - IMU_FILTER_ALPHA) * this.filteredGyro![i]!;
      }
    }

    // Gait phase (sine/cosine clock)
    if (this.gaitPhaseStartTime === null) {
      this.gaitPhaseStartTime = Date.now();
    }
    const t = (Date.now() - this.gaitPhaseStartTime) / 1000;  // seconds
    const phase = 2 * Math.PI * GAIT_PHASE_FREQ * t;
    const gaitPhaseSin = Math.sin(phase);
    const gaitPhaseCos = Math.cos(phase);

    const obs: number[] = [
      // Base linear acceleration (3) - filtered
      this.filteredAcc[0]!, this.filteredAcc[1]!, this.filteredAcc[2]!,
      // Base angular velocity (3) - filtered
      this.filteredGyro![0]!, this.filteredGyro![1]!, this.filteredGyro![2]!,
      // Projected gravity (3) - computed from quaternion
      projectedGravity[0], projectedGravity[1], projectedGravity[2],
      // Velocity commands (3)
      cmdVel[0], cmdVel[1], cmdVel[2],
      // Gait phase (2) - sine and cosine
      gaitPhaseSin, gaitPhaseCos,
      // Joint positions relative to default (14)
      ...jointPosRel,
      // Previous joint positions relative to default (14)
      ...prevJointPosRel,
      // Previous actions (14 * 4 = 56): last, second-to-last, third-to-last, fourth-to-last
      ...this.actionHistory.flat(),
    ];

    if (obs.length !== OBS_SIZE) {
      throw new Error(`Observation size mismatch: expected ${OBS_SIZE}, got ${obs.length}`);
    }

    // console.log('obs:', JSON.stringify(obs, null, 2))
    // console.log('acc obs:', JSON.stringify(obs.slice(0, 3), null, 2))
    // console.log('gyro obs:', JSON.stringify(obs.slice(3, 6), null, 2))
    // console.log('grav obs:', JSON.stringify(obs.slice(6, 9), null, 2))
    // console.log('prev joint pos obs:', JSON.stringify(obs.slice(26, 40), null, 2))
    // console.log('joint pos obs:', JSON.stringify(obs.slice(12, 26), null, 2))
    // console.log('cmd vel obs:', JSON.stringify(obs.slice(9, 12), null, 2))
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
    
    // Store raw actions for debugging
    this.lastRawActions = rawActions.slice();

    // Shift action history: [0,1,2,3] -> [new,0,1,2]
    // NOTE: Raw actions go into history (before clipping), matching sim behavior
    for (let i = ACTION_HISTORY_SIZE - 1; i > 0; i--) {
      this.actionHistory[i] = this.actionHistory[i - 1]!;
    }
    this.actionHistory[0] = rawActions.slice();

    // Clip to [-1, 1] for servo output
    const actions = rawActions.map(a => Math.max(-1, Math.min(1, a)));

    // Apply action smoothing (set ACTION_SMOOTH_ALPHA=1.0 to disable)
    if (this.smoothedAction === null) {
      this.smoothedAction = actions.slice();
    } else {
      for (let i = 0; i < actions.length; i++) {
        this.smoothedAction[i] = ACTION_SMOOTH_ALPHA * actions[i]! + (1 - ACTION_SMOOTH_ALPHA) * this.smoothedAction[i]!;
      }
    }

    return this.smoothedAction.slice();
  }

  /**
   * Get the raw policy output from the last step (before clipping/smoothing).
   */
  getLastRawActions(): number[] {
    return this.lastRawActions.slice();
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
    this.actionHistory = Array.from(
      { length: ACTION_HISTORY_SIZE },
      () => new Array(NUM_JOINTS).fill(0)
    );
    this.prevJointPos = null;
    this.gaitPhaseStartTime = null;
    this.filteredAcc = null;
    this.filteredGyro = null;
    this.smoothedAction = null;
    this.lastRawActions = new Array(NUM_JOINTS).fill(0);
  }
}
