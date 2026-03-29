import { SerialPort } from 'serialport'
import { calculateServoSpeeds, createRunLoop, crouchedPosition, makeGlobalServoValues, makeLegServoValues, RunLoopControl, sleep, standingPosition } from './utils'
import { BackboneRequestHandler } from './handlers/backboneRequestHandler'
import { PeripheryRequestHandler } from './handlers/peripheryRequestHandler'
import { connectPythonSock, pythonRequest, pythonSockSetTimeouts } from './handlers/pythonRequestHandler'
import { ServoIDs } from './types'
import { PolicyRunner, POLICY_TO_SERVO, computeProjectedGravity } from './policyRunner'
import { PolicyRunnerSimple } from './policyRunnerSimple'

import express from 'express'
import bodyParser from 'body-parser'
import { MoveHeadHandler } from './handlers'
// import { WebSocket } from 'ws'

const app = express()
const port = 3901
app.use(bodyParser.json())
// const wss = new WebSocket.Server({ port: 3902 })

/**
 * Test angle generator - produces a sine wave for testing.
 */
class TestAngleGenerator {
  amplitude = 0.0;   // radians
  frequency = 0.5;   // Hz
  offset = 0.0;      // radians
  private startTime: number | null = null;

  /** Get current angle value */
  get(): number {
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
    const t = (Date.now() - this.startTime) / 1000; // seconds
    return this.offset + this.amplitude * Math.sin(2 * Math.PI * this.frequency * t);
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
  const peripheryController = new PeripheryRequestHandler('Periphery', HeadPort)
  const backboneController = new BackboneRequestHandler('Backbone', BackbonePort)
  connectPythonSock()

  let currentLoop: RunLoopControl | null = null

  // Policy runner for locomotion control
  let policyRunner: PolicyRunner | null = null
  let policyEnabled = false
  let cmdVel: [number, number, number] = [0.0, 0.0, 0.0] // [vx, vy, wz]
  
  // Test angle generator for debugging (configure here)
  const testAngleGen = new TestAngleGenerator();
  testAngleGen.amplitude = 0.5;   // radians
  testAngleGen.frequency = 0.5;   // Hz
  testAngleGen.offset = 0.0;      // radians

  const setup = async () => {
    console.log(await peripheryController.ping())
    console.log(await backboneController.ping())
    // console.log(await pythonRequest('PING'))

    // pythonSockSetTimeouts()
  }

  setup();

  async function main1() {
    const servoPositions = await backboneController.queryPositions()
    await backboneController.setEnabled({
      1: false,
      3: false,
      5: false,
      7: false
    })
    await backboneController.setAccelSymmetric({
      2: 300,
      4: 300,
      6: 300,
      8: 300
    })
    await backboneController.setSpeed({
      2: 0,
      4: 0,
      6: 0,
      8: 0
    })
    await backboneController.setPos({
      2: 4095 - (servoPositions[1] ?? 0),
      4: 4095 - (servoPositions[3] ?? 0),
      6: 4095 - (servoPositions[5] ?? 0),
      8: 4095 - (servoPositions[7] ?? 0),
    })
  }


  let eyesR = 90
  let eyesS = 3

  setInterval(() => {
    const magicNumber = Math.random()
    if (magicNumber > 0.7) {
      eyesR = 10
      eyesS = 20
      setTimeout(() => {
        eyesR = 90
      }, 150)
      setTimeout(() => {
        eyesS = 3
      }, 300)
    } else if (magicNumber > 0.3) {
      eyesR = Math.round(90 - Math.random() * 20)
    }
  }, 1000)

  // let shouldLookAtHoomans = true
  // setInterval(() => {
  //   if (Math.random() > 0.75) {
  //     shouldLookAtHoomans = !shouldLookAtHoomans;
  //     console.log({ shouldLookAtHoomans });
  //   }
  // }, 3000)

  let randomLookAroundCounter = 50;

  async function main2() {
    // console.log('running main2')

    await peripheryController.drawEyes({
      radius: eyesR,
      speed: eyesS,
    })

    if (randomLookAroundCounter > 0) {
      randomLookAroundCounter -= 1;
    } else {
      randomLookAroundCounter = Math.round(Math.random() * 25) + 50
      await backboneController.setSpeed({ 21: 2000, 22: 2000 })
      // if (shouldLookAtHoomans) {
      // const lastServoPositions = await backboneController.queryPositions()
      // const rawYoloDetectionResults = await pythonRequest('READ_CAMERA')
      // if (rawYoloDetectionResults === null)
      //     return;
      //   await backboneController.setAccelSymmetric({ 21: 400, 22: 400 })
      //   await MoveHeadHandler(backboneController, peripheryController, rawYoloDetectionResults, lastServoPositions)
      // } else {
      await backboneController.setAccelSymmetric({ 21: 200, 22: 200, 1: 300, 3: 300 })
      await backboneController.setSpeed({ 1: 1000, 3: 1000 })

      const randX = Math.random()
      const randY = Math.random()
      await peripheryController.drawEyes({ x: 160 - randX * 80, y: 140 - randY * 24, })
      await backboneController.setPos({ 21: 1200 + randX * 1000, 22: 1900 + randY * 300, 1: 3500 + randX * 100, 2: 595 + randX * 100 })
      // }
    }
  }

  /**
   * Policy-controlled locomotion loop (50Hz).
   * Reads IMU + servo positions, runs inference, sends servo commands.
   */
  async function main3() {
        if (!policyRunner || !policyEnabled) {
      return
    }

    // try {
    //   const servoPositions = await backboneController.queryPositions()

    //   const runner = policyRunner
    //   const testAngle = testAngleGen.get();
    //   // const testAngle = cmdVel[0]!;
    //   const obs = runner.buildObservation(testAngle, servoPositions[1]!);
    //   const action = runner.step(obs);
    //   const servoTarget = runner.actionToServoPosition(action);
    //   await backboneController.setSpeed({ 1: 0, })
    //   await backboneController.setPos({ [runner.getServoId()]: servoTarget });

    // } catch (err) {
    //   console.error('[main3] Error in policy loop:', err)
    // }
    if (!policyRunner || !policyEnabled) {
      return
    }

    try {
      // Read sensors in parallel
      // Note: servoSpeeds commented out - policy trained without velocity observations
      const [imuData, servoPositions] = await Promise.all([
        peripheryController.imu(),
        backboneController.queryPositions(),
      ])
      // const servoSpeeds = await backboneController.querySpeed()

      // Check for excessive tilt (emergency stop)
      if (policyRunner.checkExcessiveTilt(imuData.quat)) {
        const projGrav = computeProjectedGravity(imuData.quat)
        console.warn('[main3] Excessive tilt detected! Disabling policy.')
        console.log('quat:', imuData.quat, 'projectedGravity:', projGrav)
        policyEnabled = false
        await backboneController.exit()
        return
      }

      // // DEBUG: Print raw IMU data
      // console.log('IMU raw:', {
      //   acc: imuData.acc,
      //   gyro: imuData.gyro,
      //   projGrav: computeProjectedGravity(imuData.quat),
      // });

      // DEBUG: Print servo positions
      // console.log('servoPositions:', servoPositions);

      // Get test angle (for debugging/testing)
      const testAngle = testAngleGen.get();

      // Build observation vector
      const obs = policyRunner.buildObservation(
        imuData,
        servoPositions,
        cmdVel,
      )
      
      // DEBUG: Print observation joint positions (indices 12-25)
      // console.log('obs jointPosRel:', obs.slice(12, 26).map(v => v.toFixed(3)));

      // Run policy inference
      const actions = policyRunner.step(obs)

      // Convert to servo positions
      const servoTargets = policyRunner.actionsToServoPositions(actions)

      // DEBUG: Print actions and servo targets
      // console.log('actions:', actions.map(a => a.toFixed(3)));
      // console.log('servoTargets:', servoTargets);

      // Send to servos
      await backboneController.setPos(servoTargets)
    } catch (err) {
      console.error('[main3] Error in policy loop:', err)
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
    res.status(200).send()
    await peripheryController.drawLoading()

    const servoPositions = await backboneController.queryPositions()

    const desiredPositions = crouchedPosition

    const desiredSpeeds = calculateServoSpeeds(servoPositions, desiredPositions, 3);
    await backboneController.setSpeed(desiredSpeeds)
    await backboneController.setPos(desiredPositions)
  })

  app.get('/stop', async (_, res) => {
    res.status(200).send()
    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }
    // await peripheryController.drawInit()
    await backboneController.exit()
  })

  app.get('/wave', async (_, res) => {
    res.status(200).send()

    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }

    try {
      await peripheryController.drawEyes({ radius: 30, speed: 10, x: 128, y: 128 })
      await sleep(150)
      await peripheryController.drawEyes({ radius: 90, speed: 10 })

      await backboneController.setSpeed({
        2: 1000,
        4: 1000,
        6: 1000,
        8: 1000
      })
      await backboneController.setAccelSymmetric({ 1: 300, 3: 300, 5: 200, 7: 150, 2: 300, 4: 300, 6: 300, 8: 300, 21: 400, 22: 400 })
      await backboneController.setSpeed({ 1: 2000, 3: 2000, 7: 4000, 21: 1000, 22: 500 })
      await backboneController.setPos({ 1: 2048, 3: 2048, 5: 2048, 7: 800, 2: 4095 - 3500, 4: 4095 - 2800, 6: 2048, 8: 4095 - 800, 21: 1800, 22: 1900 })
      await sleep(1000)
      await backboneController.setPos({ 7: 2048, 5: 2400, 22: 2100 })
      await sleep(500)
      await backboneController.setPos({ 7: 800, 5: 2048, })
      await sleep(500)
      await backboneController.setPos({ 7: 2048, 5: 2400 })
      await sleep(500)
      await backboneController.setPos({ 1: 3500, 3: 2800, 5: 2048, 7: 800, 22: 1900 })
      await peripheryController.drawEyes({ radius: 30, speed: 10 })
      await sleep(150)
      await peripheryController.drawEyes({ radius: 90, speed: 10 })
      await sleep(150)
      await peripheryController.drawEyes({ radius: 30, speed: 10 })
      await sleep(150)
      await peripheryController.drawEyes({ radius: 90, speed: 10 })
    } catch (err) {
      console.error(err)
    }
  })

  app.get('/bow', async (_, res) => {
    res.status(200).send()

    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }

    try {
      await peripheryController.drawEyes({ radius: 30, speed: 10, x: 128, y: 128 })
      await sleep(150)
      await peripheryController.drawEyes({ radius: 90, speed: 10 })

      await backboneController.setSpeed({
        2: 1000,
        4: 1000,
        6: 1000,
        8: 1000
      })
      await backboneController.setAccelSymmetric({ 1: 300, 3: 300, 5: 200, 7: 150, 2: 300, 4: 300, 6: 300, 8: 300, 21: 400, 22: 400 })
      await backboneController.setPos({ 1: 3500, 3: 2800, 5: 2048, 7: 800, 2: 4095 - 3500, 4: 4095 - 2800, 8: 4095 - 800, 21: 1800, 22: 1900 })
      await sleep(500)
      await backboneController.setPos({ 2: 1400 })
      await sleep(300)
      await backboneController.setPos({ 6: 1024 })
      await sleep(500)

      const bowPosition = {
        "13": 1410,
        "14": 2690,
        "17": 1780,
        "18": 2343,
      }
      let desiredSpeeds = calculateServoSpeeds(crouchedPosition, bowPosition, 1);
      await backboneController.setSpeed(desiredSpeeds)
      await backboneController.setPos(bowPosition)
      await backboneController.setPos({ 22: 1600 })
      await peripheryController.drawLoading()
      await sleep(1500)

      const normalPosition = {
        "13": 1610,
        "14": 2490,
        "17": 1680,
        "18": 2443,
      }
      desiredSpeeds = calculateServoSpeeds(bowPosition, normalPosition, 1);
      await backboneController.setSpeed(desiredSpeeds)
      await backboneController.setPos(normalPosition)
      await backboneController.setPos({ 22: 1900 })
      await sleep(1500)
      await backboneController.setPos({ 6: 2048 })
      await sleep(300)
      await backboneController.setPos({ 2: 595 })

    } catch (err) {
      console.error(err)
    }
  })

  app.post('/switchMain', async (req, res) => {
    await peripheryController.drawLoading()

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

    console.log(`[INFO] Starting ${mainName} loop`);
    currentLoop = createRunLoop(40, mainMap[mainName]);
    res.send(`Switched to ${mainName}`);
  });

  app.get('/stopLoop', async (_, res) => {
    res.status(200).send()
    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }
  })

  // Policy control endpoints

  /**
   * Initialize the policy runner with model path.
   * POST /policy/init { modelPath?: string }
   */
  app.post('/policy/init', async (req, res) => {
    const modelPath = req.body?.modelPath ?? 'policy.pt'
    try {
      policyRunner = new PolicyRunner(modelPath)
      res.send({ success: true, message: `Policy loaded from ${modelPath}` })
    } catch (err) {
      console.error('[policy/init] Error:', err)
      res.status(500).send({ success: false, error: String(err) })
    }
  })

  /**
   * Enable policy control and start main3 loop at 50Hz.
   * GET /policy/enable
   */
  app.get('/policy/enable', async (_, res) => {
    if (!policyRunner) {
      res.status(400).send({ success: false, error: 'Policy not initialized. Call /policy/init first.' })
      return
    }

    // Stop any existing loop
    if (currentLoop) {
      await currentLoop.stop()
      currentLoop = null
    }

    policyRunner.reset()
    policyEnabled = true
    cmdVel = [0.0, 0.0, 0.0] // Start stationary

    // Start main3 at 50Hz (20ms period)
    await backboneController.setSpeed(makeGlobalServoValues(1000))
    currentLoop = createRunLoop(20, main3, { shouldLog: true })
    console.log('[policy/enable] Policy control enabled at 50Hz')
    res.send({ success: true, message: 'Policy enabled' })
  })

  /**
   * Disable policy control.
   * GET /policy/disable
   */
  app.get('/policy/disable', async (_, res) => {
    policyEnabled = false
    if (currentLoop) {
      await currentLoop.stop()
      currentLoop = null
    }
    console.log('[policy/disable] Policy control disabled')
    res.send({ success: true, message: 'Policy disabled' })
  })

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
    const { vx = 0, vy = 0, wz = 0 } = req.body ?? {}

    // Clamp to training distribution
    const clampedVx = Math.max(0, Math.min(1.0, Number(vx)))
    const clampedVy = 0 // No lateral movement supported
    const clampedWz = Math.max(-1.0, Math.min(1.0, Number(wz)))

    cmdVel = [clampedVx, clampedVy, clampedWz]
    console.log(`[policy/cmd] Set velocity: vx=${clampedVx}, vy=${clampedVy}, wz=${clampedWz}`)
    res.send({ success: true, cmdVel })
  })

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
    })
  })

  /**
   * Joint verification test - bypasses policy, sets one joint at a time.
   * GET /policy/test/:jointIndex
   * 
   * Sets the specified joint to a test angle while keeping others at 0.
   * Returns expected visual appearance for verification.
   */
  const JOINT_TESTS: { index: number; testValue: number; name: string; expected: string }[] = [
    { index: 0,  testValue: +0.3, name: 'HIP_ROTATE_L', expected: 'Left toe rotates INWARD ~17°' },
    { index: 1,  testValue: +0.3, name: 'HIP_ROTATE_R', expected: 'Right toe rotates OUTWARD ~17°' },
    { index: 2,  testValue: +0.3, name: 'SHOULDER_MAIN_L', expected: 'Left arm swings BACKWARD ~17°' },
    { index: 3,  testValue: +0.3, name: 'SHOULDER_MAIN_R', expected: 'Right arm swings FORWARD ~17°' },
    { index: 4,  testValue: +0.25, name: 'HIP_TILT_L', expected: 'Left leg moves INWARD ~14°' },
    { index: 5,  testValue: +0.25, name: 'HIP_TILT_R', expected: 'Right leg moves INWARD ~14°' },
    { index: 6,  testValue: +0.4, name: 'HIP_MAIN_L', expected: 'Left thigh moves BACKWARD ~23°' },
    { index: 7,  testValue: +0.4, name: 'HIP_MAIN_R', expected: 'Right thigh moves FORWARD ~23°' },
    { index: 8,  testValue: +0.5, name: 'KNEE_L', expected: 'Left knee BENDS ~29°' },
    { index: 9,  testValue: -0.5, name: 'KNEE_R', expected: 'Right knee BENDS ~29° (- is bend)' },
    { index: 10, testValue: -0.3, name: 'FOOT_MAIN_L', expected: 'Left ankle: toe points UP ~17° (- is toe up)' },
    { index: 11, testValue: -0.3, name: 'FOOT_MAIN_R', expected: 'Right ankle: toe points UP ~17° (- is toe up)' },
    { index: 12, testValue: +0.2, name: 'FOOT_TILT_L', expected: 'Left foot tilts INWARD ~11°' },
    { index: 13, testValue: +0.2, name: 'FOOT_TILT_R', expected: 'Right foot tilts INWARD ~11°' },
  ]

  // app.get('/policy/test/:jointIndex', async (req, res) => {
  //   const jointIndex = parseInt(req.params.jointIndex)
    
  //   if (isNaN(jointIndex) || jointIndex < 0 || jointIndex >= 14) {
  //     res.status(400).send({ error: 'Joint index must be 0-13' })
  //     return
  //   }

  //   // Stop any running loop
  //   if (currentLoop) {
  //     await currentLoop.stop()
  //     currentLoop = null
  //   }
  //   policyEnabled = false

  //   // Create test actions: all zeros except the test joint
  //   const testActions = new Array(14).fill(0)
  //   const test = JOINT_TESTS[jointIndex]!
  //   testActions[jointIndex] = test.testValue

  //   // Use PolicyRunner to convert to servo positions (applies POLICY_SIGN_FLIP)
  //   if (!policyRunner) {
  //     policyRunner = new PolicyRunner('policy.pt')
  //   }
  //   const servoTargets = policyRunner.actionsToServoPositions(testActions)

  //   // Set slow speed for safety
  //   const speedTargets: Record<number, number> = {}
  //   for (const servoId of Object.keys(servoTargets)) {
  //     speedTargets[Number(servoId)] = 500
  //   }
  //   await backboneController.setSpeed(speedTargets)
  //   await backboneController.setPos(servoTargets)

  //   console.log(`[policy/test] Joint ${jointIndex} (${test.name}) set to ${test.testValue} rad`)
  //   console.log(`[policy/test] Expected: ${test.expected}`)
  //   console.log(`[policy/test] Servo targets:`, servoTargets)

  //   res.send({
  //     jointIndex,
  //     jointName: test.name,
  //     testValue: test.testValue,
  //     testValueDeg: Math.round(test.testValue * 180 / Math.PI),
  //     expected: test.expected,
  //     servoTargets,
  //   })
  // })

  // /**
  //  * Reset all joints to neutral (0 rad).
  //  * GET /policy/test/reset
  //  */
  // app.get('/policy/test-reset', async (_, res) => {
  //   // Stop any running loop
  //   if (currentLoop) {
  //     await currentLoop.stop()
  //     currentLoop = null
  //   }
  //   policyEnabled = false

  //   // All zeros
  //   const testActions = new Array(14).fill(0)
    
  //   if (!policyRunner) {
  //     policyRunner = new PolicyRunner('policy.pt')
  //   }
  //   const servoTargets = policyRunner.actionsToServoPositions(testActions)

  //   const speedTargets: Record<number, number> = {}
  //   for (const servoId of Object.keys(servoTargets)) {
  //     speedTargets[Number(servoId)] = 500
  //   }
  //   await backboneController.setSpeed(speedTargets)
  //   await backboneController.setPos(servoTargets)

  //   console.log('[policy/test-reset] All joints set to 0 (neutral)')
  //   res.send({ message: 'All joints reset to neutral', servoTargets })
  // })

  app.listen(port, () => {
    console.log(`Robot server running on port ${port}`)
  })

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
}
