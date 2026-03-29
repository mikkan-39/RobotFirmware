import { servoConfig, ServoMiddle } from './types';

// Native addon for PyTorch inference
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/JSClang.node') as {
  loadModel: (path: string) => void;
  runModel: (input: number[]) => number[];
};

// SHOULDER_MAIN_R config
const SERVO_ID = 1;           // Servo ID for SHOULDER_MAIN_R
const SIGN_FLIP = -1;         // From POLICY_SIGN_FLIP[3]
const DEFAULT_POS = -1.57;    // From DEFAULT_JOINT_POS[3] (arms down)

// Servo steps per radian
const STEPS_PER_RAD = 4095 / (2 * Math.PI);

// Observation size: testAngle(1) + position(1) + lastActions(4) = 6
const OBS_SIZE = 6;
const ACTION_HISTORY_SIZE = 4;

export class PolicyRunnerSimple {
  // Action history: [0]=most recent, [1]=second most recent, etc.
  private actionHistory: number[] = new Array(ACTION_HISTORY_SIZE).fill(0);
  private modelLoaded = false;

  constructor(modelPath: string) {
    addon.loadModel(modelPath);
    this.modelLoaded = true;
    console.log(`[PolicyRunnerSimple] Model loaded from ${modelPath}`);
  }

  /**
   * Convert servo position (0-4095) to radians.
   */
  private servoToRad(servoPos: number): number {
    const config = servoConfig[SERVO_ID];
    if (!config) throw new Error(`Unknown servo ID: ${SERVO_ID}`);
    const symmetricRad = config.direction * (servoPos - ServoMiddle) / STEPS_PER_RAD;
    return symmetricRad * SIGN_FLIP;
  }

  /**
   * Convert radians to servo position (0-4095).
   */
  private radToServo(rad: number): number {
    const config = servoConfig[SERVO_ID];
    if (!config) throw new Error(`Unknown servo ID: ${SERVO_ID}`);
    // Apply sign flip to convert from URDF to symmetric, then config.direction for servo
    const symmetricRad = rad * SIGN_FLIP;
    return Math.round(ServoMiddle + config.direction * symmetricRad * STEPS_PER_RAD);
  }

  /**
   * Build observation vector.
   * @param testAngle Raw test angle (radians)
   * @param servoPos Servo position (0-4095)
   */
  buildObservation(testAngle: number, servoPos: number): number[] {
    const posRad = this.servoToRad(servoPos) - DEFAULT_POS;  // Relative to default

    const obs = [
      testAngle,
      posRad,
      // Action history: last, second-to-last, third-to-last, fourth-to-last
      ...this.actionHistory,
    ];

    if (obs.length !== OBS_SIZE) {
      throw new Error(`Observation size mismatch: expected ${OBS_SIZE}, got ${obs.length}`);
    }

    console.log(`[Simple] obs: testAngle=${testAngle.toFixed(3)}, pos=${posRad.toFixed(3)}, acts=[${this.actionHistory.map(a => a.toFixed(3)).join(', ')}]`);
    return obs;
  }

  /**
   * Run policy inference and return action.
   */
  step(obs: number[]): number {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    const rawActions = addon.runModel(obs);
    const action = Math.max(-1, Math.min(1, rawActions[0] ?? 0));

    // Shift history: [0,1,2,3] -> [new,0,1,2]
    for (let i = ACTION_HISTORY_SIZE - 1; i > 0; i--) {
      this.actionHistory[i] = this.actionHistory[i - 1]!;
    }
    this.actionHistory[0] = action;

    return action;
  }

  /**
   * Convert action to servo position.
   * @param action Action value (-1 to 1)
   * @returns Servo position (0-4095)
   */
  actionToServoPosition(action: number): number {
    // Target position = default + action (action scale is 1.0 rad)
    const targetRad = DEFAULT_POS + action * 1.0;
    const servoPos = this.radToServo(targetRad);
    return Math.max(0, Math.min(4095, servoPos));
  }

  /**
   * Reset internal state.
   */
  reset(): void {
    this.actionHistory = new Array(ACTION_HISTORY_SIZE).fill(0);
  }

  /**
   * Get the servo ID this runner controls.
   */
  getServoId(): number {
    return SERVO_ID;
  }
}
