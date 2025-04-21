import type { ChildProcessWithoutNullStreams } from 'child_process'
import { BackboneMsg, HeadMsg, MasterHandlerState, PythonMsg, ServoIDs } from './types'
import { SerialPort } from 'serialport'
import {
  handleResetServoSettings,
  MirrorHandHandler,
  MoveHeadHandler,
} from './handlers'
import { makeMoveServosCommand } from './commands'
import { createRunLoop, isUpright, makeLegServoValues, sittingPosition, standingPosition } from './utils'
import { ProcessMsgHandler } from './processMsgHandler'
import RequestResponseHandler from './requestHandler'
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
  pythonProcess: ChildProcessWithoutNullStreams,
) => {
  const pythonController = new RequestResponseHandler<PythonMsg>('Python', pythonProcess);
  const headController = new RequestResponseHandler<HeadMsg>('Head', HeadPort);
  const backboneController = new RequestResponseHandler<BackboneMsg>('Backbone', BackbonePort);

  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      lastServoPositions: {},
      lastServoSpeeds: {},
      lastYoloDetectionResult: [],
    },
  }

  async function main() {
    switch (state.type) {
      case 'INIT':
        try {
          const pyPingResponse = await pythonController.send('PING')
          const headPingResponse = await headController.send('PING')
          const backbonePingResponse = await backboneController.send('PING')
        } catch (err) {
          console.error(err)
          state.type = 'ERROR'
          return
        }
        break
      case 'ERROR':
        break
      case 'READY':
        break
    }
  }

  const runLoop = createRunLoop(20, main);

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
