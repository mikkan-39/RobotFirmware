import { SerialPort } from 'serialport'
import { calculateServoSpeeds, createRunLoop, crouchedPosition, makeGlobalServoValues, makeLegServoValues, RunLoopControl, sleep, standingPosition } from './utils'
import { BackboneRequestHandler } from './handlers/backboneRequestHandler'
import { PeripheryRequestHandler } from './handlers/peripheryRequestHandler'
import { connectPythonSock, pythonRequest, pythonSockSetTimeouts } from './handlers/pythonRequestHandler'
import { ServoIDs } from './types'

import express from 'express'
import bodyParser from 'body-parser'
import { MoveHeadHandler } from './handlers'
// import { WebSocket } from 'ws'

const app = express()
const port = 3901
app.use(bodyParser.json())
// const wss = new WebSocket.Server({ port: 3902 })

export const MasterHandler = (
  BackbonePort: SerialPort,
  HeadPort: SerialPort,
) => {
  const peripheryController = new PeripheryRequestHandler('Periphery', HeadPort)
  const backboneController = new BackboneRequestHandler('Backbone', BackbonePort)
  connectPythonSock()

  let currentLoop: RunLoopControl | null = null

  const setup = async () => {
    console.log(await peripheryController.ping())
    console.log(await backboneController.ping())
    // console.log(await pythonRequest('PING'))

    // pythonSockSetTimeouts()
  }

  setup();

  async function main1() {
    // console.log('running main1')
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

  let shouldLookAtHoomans = true
  let randomLookAroundCounter = 100;
  setInterval(() => {
    if (Math.random() > 0.75) {
      shouldLookAtHoomans = !shouldLookAtHoomans;
      console.log({ shouldLookAtHoomans });
    }
  }, 3000)

  async function main2() {
    // console.log('running main2')

    await peripheryController.drawEyes({
      radius: eyesR,
      speed: eyesS,
    })

    if (randomLookAroundCounter > 0) {
      randomLookAroundCounter -= 1;
    } else {
      randomLookAroundCounter = Math.round(Math.random() * 50) + 50
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

  async function main3() {
    // console.log('running main3')
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

    // const desiredPositions = standingPosition
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
    await peripheryController.drawInit()
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

      await backboneController.setAccelSymmetric({ 1: 300, 3: 300, 5: 200, 7: 150, 2: 300, 4: 300, 8: 300, 21: 400, 22: 400 })
      await backboneController.setSpeed({ 1: 2000, 3: 2000, 7: 4000, 21: 1000, 22: 500 })
      await backboneController.setPos({ 1: 2048, 3: 2048, 5: 2048, 7: 800, 2: 4095 - 3500, 4: 4095 - 2800, 6: 2048, 8: 4095 - 800, 21: 1800, 22: 1900 })
      await sleep(1000)
      await backboneController.setPos({ 7: 2048, 5: 2400, 22: 1700 })
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
