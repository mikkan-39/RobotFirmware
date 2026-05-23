import {SerialPort} from 'serialport';
import {
  calculateServoSpeeds,
  createRunLoop,
  crouchedPosition,
  makeGlobalServoValues,
  makeLegServoValues,
  RunLoopControl,
  sleep,
  standingPosition,
} from './utils';
import {BackboneRequestHandler} from './handlers/backboneRequestHandler';
import {PeripheryRequestHandler} from './handlers/peripheryRequestHandler';
import {
  connectPythonSock,
  pythonRequest,
  pythonSockSetTimeouts,
} from './handlers/pythonRequestHandler';
import {ServoIDs} from './types';
import {
  PolicyRunner,
  computeProjectedGravity,
  POLICY_DEBUG_LOGGING,
} from './policyRunner';
import * as fs from 'fs';

import express from 'express';
import bodyParser from 'body-parser';
import {MoveHeadHandler} from './handlers';
import {SineGaitRunner} from './sineGaitRunner';
// import { WebSocket } from 'ws'

const app = express();
const port = 3901;
app.use(bodyParser.json());
// const wss = new WebSocket.Server({ port: 3902 })

/**
 * Test angle generator - produces a sine wave for testing.
 */
class TestAngleGenerator {
  amplitude = 0.0; // radians
  frequency = 0.5; // Hz
  offset = 0.0; // radians
  private startTime: number | null = null;

  /** Get current angle value */
  get(): number {
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
    const t = (Date.now() - this.startTime) / 1000; // seconds
    return (
      this.offset + this.amplitude * Math.sin(2 * Math.PI * this.frequency * t)
    );
  }

  /** Reset the phase (restart from t=0) */
  reset(): void {
    this.startTime = null;
  }

  /** Configure the generator */
  configure(amplitude: number, frequency: number, offset: number): void {
    this.amplitude = amplitude;
    this.frequency = frequency;
    this.offset = offset;
  }
}

export const MasterHandler = (
  BackbonePort: SerialPort,
  HeadPort: SerialPort,
) => {
  const peripheryController = new PeripheryRequestHandler(
    'Periphery',
    HeadPort,
  );
  const backboneController = new BackboneRequestHandler(
    'Backbone',
    BackbonePort,
  );
  connectPythonSock();

  let currentLoop: RunLoopControl | null = null;

  // Policy runner for locomotion control
  let policyRunner: PolicyRunner | null = null;
  let sineGaitRunner: SineGaitRunner | null = null;
  let policyEnabled = false;
  let cmdVel: [number, number, number] = [0.0, 0.0, 0.0]; // [vx, vy, wz]

  // Test angle generator for debugging (configure here)
  const testAngleGen = new TestAngleGenerator();

  // Debug logging state
  let debugLogStream: fs.WriteStream | null = null;
  let debugLogStartTime: number = 0;
  testAngleGen.amplitude = 0.5; // radians
  testAngleGen.frequency = 0.5; // Hz
  testAngleGen.offset = 0.0; // radians

  const setup = async () => {
    // console.log(await peripheryController.ping());
    console.log(await backboneController.ping());
    // console.log(await pythonRequest('PING'))

    // pythonSockSetTimeouts()
  };

  setup();

  async function main1() {
    console.clear();
    const imuData = await peripheryController.imu();
    console.log(JSON.stringify({imuData}, null, 2));
    console.log(
      JSON.stringify(
        {computedGrav: computeProjectedGravity(imuData.quat)},
        null,
        2,
      ),
    );
  }

  async function main2() {
    if (!sineGaitRunner) {
      return;
    }

    const servoTargets = sineGaitRunner.step();
    await backboneController.setPos(servoTargets);
  }

  /**
   * Policy-controlled locomotion loop (50Hz).
   * Reads IMU + servo positions, runs inference, sends servo commands.
   */
  async function main3() {
    if (!policyRunner || !policyEnabled) {
      return;
    }

    if (!policyRunner || !policyEnabled) {
      return;
    }

    try {
      const tickTimestamp = Date.now() - debugLogStartTime;

      // Read sensors in parallel
      const [imuData, servoPositions] = await Promise.all([
        peripheryController.imu(),
        backboneController.queryPositions(),
      ]);

      // Check for excessive tilt (emergency stop)
      if (policyRunner.checkExcessiveTilt(imuData.quat)) {
        const projGrav = computeProjectedGravity(imuData.quat);
        console.warn('[main3] Excessive tilt detected! Disabling policy.');
        console.log('quat:', imuData.quat, 'projectedGravity:', projGrav);
        policyEnabled = false;
        await backboneController.exit();
        await peripheryController.drawError();
        setTimeout(() => {
          peripheryController.drawInit();
        }, 5000);
        return;
      }

      // Build observation vector
      const obs = policyRunner.buildObservation(
        imuData,
        servoPositions,
        cmdVel,
      );

      // Run policy inference
      const servoTargets = policyRunner.step(obs);
      const rawActions = policyRunner.getLastRawActions();

      // Send to servos
      await backboneController.setPos(servoTargets);
      // console.log({servoTargets: JSON.stringify(servoTargets, null, 2)});

      // Debug logging
      if (POLICY_DEBUG_LOGGING && debugLogStream) {
        // Round floats to 2 decimals for readability
        const r = (arr: number[]) => arr.map((v) => Math.round(v * 100) / 100);
        const logEntry = {
          timestamp_ms: tickTimestamp,
          observation: r(obs),
          raw_actions: r(rawActions),
          servo_targets: servoTargets,
        };
        debugLogStream.write(JSON.stringify(logEntry, null, 2) + '\n\n');
      }
    } catch (err) {
      console.error('[main3] Error in policy loop:', err);
    }
  }

  // runLoop.stop()
  // runLoop.pause()
  // runLoop.resume()
  // runLoop.isRunning()

  const mainMap: Record<string, () => Promise<void>> = {
    main1,
    main2,
    main3,
  };

  app.get('/start', async (_, res) => {
    res.status(200).send();
    // await peripheryController.drawLoading();

    const servoPositions = await backboneController.queryPositions();

    const desiredPositions = crouchedPosition;

    const desiredSpeeds = calculateServoSpeeds(
      servoPositions,
      desiredPositions,
      3,
    );
    await backboneController.setSpeed(desiredSpeeds);
    await backboneController.setPos(desiredPositions);
  });

  app.get('/stop', async (_, res) => {
    res.status(200).send();
    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }
    await backboneController.exit();
    // await peripheryController.drawInit();
  });

  app.post('/switchMain', async (req, res) => {
    // await peripheryController.drawLoading();

    const mainName = req.body?.main;

    if (!mainMap[mainName]) {
      res.status(400).send(`Unknown main function: ${mainName}`);
      return;
    }

    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }

    if (mainName === 'main2') {
      await backboneController.setSpeed(makeGlobalServoValues(3300));
      sineGaitRunner = new SineGaitRunner();
      sineGaitRunner.reset();
    }

    console.log(`[INFO] Starting ${mainName} loop`);
    currentLoop = createRunLoop(20, mainMap[mainName]);
    res.send(`Switched to ${mainName}`);
  });

  app.get('/stopLoop', async (_, res) => {
    res.status(200).send();
    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }
  });

  // Policy control endpoints

  /**
   * Initialize the policy runner with model path.
   * POST /policy/init { modelPath?: string }
   */
  app.post('/policy/init', async (req, res) => {
    const modelPath = req.body?.modelPath ?? 'policy.pt';
    try {
      policyRunner = new PolicyRunner(modelPath);
      res.send({success: true, message: `Policy loaded from ${modelPath}`});
    } catch (err) {
      console.error('[policy/init] Error:', err);
      res.status(500).send({success: false, error: String(err)});
    }
  });

  /**
   * Enable policy control and start main3 loop at 50Hz.
   * GET /policy/enable
   */
  app.get('/policy/enable', async (_, res) => {
    if (!policyRunner) {
      res.status(400).send({
        success: false,
        error: 'Policy not initialized. Call /policy/init first.',
      });
      return;
    }

    // Stop any existing loop
    if (currentLoop) {
      await currentLoop.stop();
      currentLoop = null;
    }

    policyRunner.reset();
    policyEnabled = true;
    cmdVel = [0.0, 0.0, 0.0]; // Start stationary

    // Start debug logging if enabled
    if (POLICY_DEBUG_LOGGING) {
      const logFilename = `policy_debug_${Date.now()}.jsonl`;
      debugLogStream = fs.createWriteStream(logFilename);
      debugLogStartTime = Date.now();
      console.log(`[policy/enable] Debug logging to ${logFilename}`);
    }

    // Start main3 at 50Hz (20ms period)
    // await backboneController.setSpeed(makeGlobalServoValues(7239));
    await backboneController.setSpeed(makeGlobalServoValues(3300));
    currentLoop = createRunLoop(20, main3, {shouldLog: true});
    console.log('[policy/enable] Policy control enabled at 50Hz');
    res.send({success: true, message: 'Policy enabled'});
  });

  /**
   * Disable policy control.
   * GET /policy/disable
   */
  app.get('/policy/disable', async (_, res) => {
    policyEnabled = false;
    if (currentLoop) {
      await currentLoop.stop();
      await peripheryController.drawInit();
      currentLoop = null;
    }

    // Close debug log if open
    if (debugLogStream) {
      debugLogStream.end();
      console.log('[policy/disable] Debug log closed');
      debugLogStream = null;
    }

    console.log('[policy/disable] Policy control disabled');
    res.send({success: true, message: 'Policy disabled'});
  });

  /**
   * Set velocity command [vx, vy, wz].
   * POST /policy/cmd { vx: number, vy: number, wz: number }
   *
   * Safe ranges from training:
   *   vx: [0.0, 1.0] m/s
   *   vy: [0.0, 0.0] m/s (no lateral)
   *   wz: [-1.0, 1.0] rad/s
   */
  app.post('/policy/cmd', (req, res) => {
    const {vx = 0, vy = 0, wz = 0} = req.body ?? {};

    // Clamp to training distribution
    const clampedVx = Math.max(0, Math.min(1.0, Number(vx)));
    const clampedVy = 0; // No lateral movement supported
    const clampedWz = Math.max(-1.0, Math.min(1.0, Number(wz)));

    cmdVel = [clampedVx, clampedVy, clampedWz];
    console.log(
      `[policy/cmd] Set velocity: vx=${clampedVx}, vy=${clampedVy}, wz=${clampedWz}`,
    );
    res.send({success: true, cmdVel});
  });

  /**
   * Get current policy status.
   * GET /policy/status
   */
  app.get('/policy/status', (_, res) => {
    res.send({
      initialized: policyRunner !== null,
      enabled: policyEnabled,
      cmdVel,
      loopRunning: currentLoop?.isRunning() ?? false,
    });
  });

  /**
   * Step response test for servo characterization.
   * GET /test_step
   *
   * Records position tracking at 50Hz while applying a step input.
   */
  app.get('/testStep', async (_, res) => {
    const SERVO_ID = 7; // ELBOW_MAIN_R
    const STEPS_PER_RAD = 4095 / (2 * Math.PI);
    const START_POS = 2048;
    const TARGET_POS = 1024;
    const RECORD_HZ = 50;
    const RECORD_INTERVAL_MS = 1000 / RECORD_HZ;

    // Stop any running loop
    if (currentLoop) {
      await currentLoop.stop();
      currentLoop = null;
    }
    policyEnabled = false;

    console.log('[test_step] Starting step response test...');

    // Set speed to 0 (no limit) and move to start position
    await backboneController.setSpeed({[SERVO_ID]: 0});
    await backboneController.setAccelSymmetric({[SERVO_ID]: 0});
    await backboneController.setPos({[SERVO_ID]: START_POS});

    // Wait for servo to reach start position
    await sleep(500);

    // Prepare CSV data
    const csvRows: string[] = ['timestamp_ms,targetRad,actualRad'];
    const startTime = Date.now();
    let targetPos = START_POS;

    // Helper to convert servo pos to radians
    const posToRad = (pos: number) => (pos - 2048) / STEPS_PER_RAD;

    // Recording function
    const recordSample = async () => {
      const positions = await backboneController.queryPositions();
      const actualPos = positions[SERVO_ID] ?? 2048;
      const timestamp = Date.now() - startTime;
      const targetRad = posToRad(targetPos);
      const actualRad = posToRad(actualPos);
      csvRows.push(
        `${timestamp},${targetRad.toFixed(6)},${actualRad.toFixed(6)}`,
      );
    };

    // Phase 1: Record at start position for 0.5s
    console.log('[test_step] Phase 1: Recording at start position...');
    for (let i = 0; i < 25; i++) {
      // 25 samples = 0.5s at 50Hz
      await recordSample();
      await sleep(RECORD_INTERVAL_MS);
    }

    // Phase 2: Apply step and record for 0.5s
    console.log('[test_step] Phase 2: Applying step to target...');
    targetPos = TARGET_POS;
    await backboneController.setPos({[SERVO_ID]: TARGET_POS});
    for (let i = 0; i < 25; i++) {
      await recordSample();
      await sleep(RECORD_INTERVAL_MS);
    }

    // Save CSV
    const filename = `step_response_${Date.now()}.csv`;
    const fs = await import('fs');
    fs.writeFileSync(filename, csvRows.join('\n'));

    console.log(
      `[test_step] Done. Saved ${csvRows.length} samples to ${filename}`,
    );
    res.send({
      success: true,
      filename,
      samples: csvRows.length,
      startPosRad: posToRad(START_POS),
      targetPosRad: posToRad(TARGET_POS),
    });
  });

  app.listen(port, () => {
    console.log(`Robot server running on port ${port}`);
  });

  // wss.on('connection', (ws) => {
  //   console.log('WebSocket connection established')

  //   ws.send(JSON.stringify({ state }))

  //   // Handle incoming messages from the client
  //   ws.on('message', (message) => {
  //     console.log('Received:', message)
  //   })

  //   ws.on('close', () => {
  //     console.log('WebSocket connection closed')
  //   })
  // })
};
