import type { ChildProcessWithoutNullStreams } from 'child_process'
import { MasterHandlerState, ServoIDs } from './types'
import { SerialPort } from 'serialport'
import { createRunLoop, isUpright, makeGlobalServoValues, makeLegServoValues, sittingPosition, standingPosition } from './utils'
import * as zmq from "zeromq";
import { BackboneRequestHandler } from './handlers/backboneRequestHandler'
import { PeripheryRequestHandler } from './handlers/peripheryRequestHandler'

// import express from 'express'
// import bodyParser from 'body-parser'
// import { WebSocket } from 'ws'

// const app = express()
// const port = 3901
// app.use(bodyParser.json())
// const wss = new WebSocket.Server({ port: 3902 })

export const MasterHandler = (
  BackbonePort: SerialPort,
  HeadPort: SerialPort,
) => {
  // const pythonController = new RequestResponseHandler<PythonMsg>('Python', pythonProcess);

  // const pythonSock = new zmq.Request();
  // pythonSock.connect("tcp://127.0.0.1:5836");
  // await pythonSock.send(JSON.stringify({ method: "status" }));
  // const [reply] = await pythonSock.receive();
  // reply && console.log("Python reply:", JSON.parse(reply.toString()));

  const peripheryController = new PeripheryRequestHandler('Periphery', HeadPort);
  const backboneController = new BackboneRequestHandler('Backbone', BackbonePort);

  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      lastServoPositions: {},
      lastServoSpeeds: {},
      lastYoloDetectionResult: [],
    },
  }


  const testFunc = async () => {
    console.log(await peripheryController.ping())
    console.log(await peripheryController.drawLoading())
    console.log(await peripheryController.tof())
    console.log(await peripheryController.imu())
    console.log(await backboneController.ping())
    console.log(await backboneController.queryPositions())
    console.log(await backboneController.querySpeed())

    console.log(await backboneController.setSpeed(makeGlobalServoValues(500)))
    console.log(await backboneController.setPos({ 2: 2048 }))
    setTimeout(async () => { console.log(await backboneController.setPos(makeLegServoValues(2048))) }, 3000)
    setTimeout(async () => { console.log(await backboneController.setPos({ 2: 4095 })) }, 5000)
    setTimeout(async () => { console.log(await backboneController.setPos({ 2: 2048 })) }, 10000)
    setTimeout(async () => { console.log(await backboneController.exit()); console.log(await peripheryController.drawInit()) }, 11000)

    // async function main() {
    //   console.log(await backboneController.queryPositions())
    // }

    // const runLoop = createRunLoop(20, main);
  }

  testFunc();



  // runLoop.stop()
  // runLoop.pause()
  // runLoop.resume()
  // runLoop.isRunning()

  // app.get('/state', (_, res) => {
  //   res.json({ state })
  // })

  // app.patch('/state', (req, res) => {
  //   if (!Object.keys(req.body).every((key) => key in state)) {
  //     res.statusCode = 400
  //   } else {
  //     Object.assign(state, req.body)
  //     res.json({ message: 'State updated successfully.', state })
  //   }
  // })

  // app.listen(port, () => {
  //   console.log(`Robot server running on port ${port}`)
  // })

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
