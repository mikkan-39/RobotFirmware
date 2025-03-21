import type {ChildProcessWithoutNullStreams} from 'child_process'
import {MasterHandlerState, UpdaterMsg, StdinHandlers, ServoIDs} from './types'
import {SerialPort} from 'serialport'
import {
  handleResetServoSettings,
  MirrorHandHandler,
  MoveHeadHandler,
} from './handlers'
import {makeMoveServosCommand} from './commands'
import {isUpright, makeLegServoValues, sittingPosition} from './utils'
import {ProcessMsgHandler} from './processMsgHandler'
import express from 'express'
import bodyParser from 'body-parser'
import {WebSocket} from 'ws'

const app = express()
const port = 3901
app.use(bodyParser.json())
const wss = new WebSocket.Server({port: 3902})

export const MasterHandler = (
  BackbonePort: SerialPort,
  pythonProcess: ChildProcessWithoutNullStreams,
  Rp2040Port: SerialPort,
) => {
  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      cppWaiting: false,
      pythonWaiting: true,
      rp2040Waiting: false, // no init msg as rp2040 boots first anyway
      lastServoPositions: {},
      lastServoMoving: {},
      lastServoSpeeds: {},
      lastYoloDetectionResult: [],
    },
  }

  const handlers: StdinHandlers = {
    cpp: (command) => {
      if (
        !command.includes('SET_SERVO') &&
        !command.includes('SERVOS_QUERY_POSITIONS')
      ) {
        state.data.cppWaiting = true
      }
      console.log('Backbone request -> ' + command)
      BackbonePort.write(command + '\n')
      BackbonePort.drain()
    },
    py: (command) => {
      state.data.pythonWaiting = true
      // console.log('Python request -> ' + command)
      pythonProcess.stdin.write(command + '\n')
    },
    rp2040: (command) => {
      if (!command.includes('DRAW')) {
        state.data.rp2040Waiting = true
      }
      // console.log('RP2040 request -> ' + command)
      Rp2040Port.write(command + '\n')
      Rp2040Port.drain()
    },
  }

  const commonUpdate = (msg: UpdaterMsg) => {
    ProcessMsgHandler({msg, state})

    if (
      !state.data.pythonWaiting &&
      !state.data.cppWaiting &&
      !state.data.rp2040Waiting // FIXME
    ) {
      const currentStateType = state.type
      switch (currentStateType) {
        case 'INIT':
          state.type = 'PINGING'
          handlers.py('PING')
          handlers.cpp('PING')
          handlers.rp2040('PING')
          handlers.rp2040('DRAW_LOADING')
          break

        case 'PINGING':
          state.type = 'UNKNOWN POSITION'
          // handleResetServoSettings(handlers) //FIXME
          handlers.cpp('SERVOS_QUERY_POSITIONS')
          handlers.rp2040('READ_IMU')
          break

        case 'UNKNOWN POSITION':
        // if (state.data.isRobotSitting) state.type = 'SITTING'
        // break

        case 'SITTING':
        // if (isUpright(state)) {
        //   handlers.cpp(
        //     makeMoveServosCommand(
        //       {
        //         ...makeLegServoValues(200),
        //         [ServoIDs.KNEE_R]: 400,
        //         [ServoIDs.KNEE_L]: 400,
        //       },
        //       'SPEED',
        //     ),
        //   )
        //   handlers.cpp(makeMoveServosCommand(makeLegServoValues(2048)))
        //   state.type = 'READY'
        // }

        // case 'READY':

        default:
          MoveHeadHandler({state, handlers})
          // MirrorHandHandler({state, handlers})
          handlers.cpp('SERVOS_QUERY_POSITIONS')
          handlers.rp2040('READ_IMU')
      }

      if (currentStateType !== state.type) {
        console.log('New state type -> ', state.type)
        switch (state.type) {
          case 'UNKNOWN POSITION':
            setInterval(() => handlers.py('READ_CAMERA'), 50)
            handlers.cpp(
              makeMoveServosCommand(
                {
                  [ServoIDs.HEAD_HORIZONTAL]: 100,
                  [ServoIDs.HEAD_VERTICAL]: 100,
                },
                'TORQUE',
              ),
            )
          // handlers.cpp(
          //   makeMoveServosCommand(
          //     {
          //       ...makeLegServoValues(200),
          //       [ServoIDs.KNEE_R]: 400,
          //       [ServoIDs.KNEE_L]: 400,
          //     },
          //     'SPEED',
          //   ),
          // )
          // handlers.cpp(makeMoveServosCommand(sittingPosition))
        }
      }
    }
  }

  app.get('/state', (_, res) => {
    res.json({state})
  })

  app.patch('/state', (req, res) => {
    if (!Object.keys(req.body).every((key) => key in state)) {
      res.statusCode = 400
    } else {
      Object.assign(state, req.body)
      res.json({message: 'State updated successfully.', state})
    }
  })

  app.listen(port, () => {
    console.log(`Robot server running on port ${port}`)
  })

  wss.on('connection', (ws) => {
    console.log('WebSocket connection established')

    ws.send(JSON.stringify({state}))

    // Handle incoming messages from the client
    ws.on('message', (message) => {
      console.log('Received:', message)
    })

    ws.on('close', () => {
      console.log('WebSocket connection closed')
    })
  })

  let backboneBuffer = ''
  BackbonePort.on('data', (data: Buffer) => {
    backboneBuffer += data.toString()
    if (backboneBuffer.indexOf('\n') === -1) {
      return
    }
    const lines = backboneBuffer.split('\n')

    if (backboneBuffer[backboneBuffer.length - 1] !== '\n') {
      backboneBuffer = lines.pop() || ''
    } else {
      backboneBuffer = ''
    }

    lines.forEach((line) => {
      if (line.trim() !== '') {
        console.log('Backbone response <- ' + line)
        try {
          state.data.cppWaiting = false
          commonUpdate({cppMsg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })

  let Rp2040Buffer = ''
  Rp2040Port.on('data', (data: Buffer) => {
    Rp2040Buffer += data.toString()
    if (Rp2040Buffer.indexOf('\n') === -1) {
      return
    }

    const lines = Rp2040Buffer.split('\n')

    if (Rp2040Buffer[Rp2040Buffer.length - 1] !== '\n') {
      Rp2040Buffer = lines.pop() || ''
    } else {
      Rp2040Buffer = ''
    }

    lines.forEach((line) => {
      if (line.trim() !== '') {
        // console.log('rp2040 RESPONSE <- ' + line)
        try {
          state.data.rp2040Waiting = false
          commonUpdate({rp2040msg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })

  pythonProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString()
    const lines = output.split('\n')
    lines.forEach((line) => {
      if (line !== '') {
        // console.log('Python response <- ' + line)
        try {
          state.data.pythonWaiting = false
          commonUpdate({pythonMsg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })
}
