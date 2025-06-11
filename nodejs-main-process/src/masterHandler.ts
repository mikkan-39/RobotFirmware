import { SerialPort } from 'serialport'
import { createRunLoop, RunLoopControl } from './utils'
import { BackboneRequestHandler } from './handlers/backboneRequestHandler'
import { PeripheryRequestHandler } from './handlers/peripheryRequestHandler'
import { pythonRequest } from './handlers/pythonRequestHandler'

import express from 'express'
import bodyParser from 'body-parser'
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

  let currentLoop: RunLoopControl | null = null

  const setup = async () => {
    await peripheryController.ping()
    await backboneController.ping()
    // const pyReply = await pythonRequest('PING')
    // pyReply && console.log("Python reply:", JSON.parse(pyReply.toString()))

    if (currentLoop == null)
      currentLoop = createRunLoop(200, main1)
  }

  setup();

  async function main1() {
    console.log('running main1')
  }

  async function main2() {
    console.log('running main2')
  }

  async function main3() {
    console.log('running main3')
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
    peripheryController.drawLoading()
    if (currentLoop == null)
      currentLoop = createRunLoop(200, main1)
  })

  app.get('/stop', async (_, res) => {
    res.status(200).send()
    if (currentLoop) {
      console.log(`[INFO] Stopping current loop...`);
      await currentLoop.stop();
      currentLoop = null;
    }
    flag = !flag
    peripheryController.drawInit()
  })

  let flag = false;
  app.get('/ping', async (_, res) => {
    res.status(200).send()
    flag = !flag
    peripheryController.drawEyes({ radius: flag ? 30 : 90, speed: 10 })
  })

  app.post('/switchMain', async (req, res) => {
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
    currentLoop = createRunLoop(200, mainMap[mainName]); // adjust period as needed
    res.send(`Switched to ${mainName}`);
  });

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
