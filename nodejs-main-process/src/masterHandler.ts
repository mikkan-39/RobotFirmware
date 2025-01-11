import type {ChildProcessWithoutNullStreams} from 'child_process'
import {MasterHandlerState, UpdaterMsg, StdinHandlers, ServoIDs} from './types'
import {SerialPort} from 'serialport'
import {
  handleResetServoSettings,
  MirrorHandHandler,
  MoveHeadHandler,
  ReceiveReadCameraHandler,
  ReceiveReadIMUHandler,
  ReceiveReadTOFHandler,
  ReceiveServosQueryMovingHandler,
  ReceiveServosQueryPositionsHandler,
  ReceiveServosQuerySpeedHandler,
} from './handlers'
import {makeMoveServosCommand} from './commands'
import {
  isUpright,
  makeGlobalServoValues,
  makeLegServoValues,
  sittingPosition,
} from './utils'

export const MasterHandler = (
  cppProcess: ChildProcessWithoutNullStreams,
  pythonProcess: ChildProcessWithoutNullStreams,
  Rp2040Port: SerialPort,
) => {
  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      cppWaiting: true,
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
      if (!command.includes('SET_SERVO')) {
        state.data.cppWaiting = true
      }
      console.log('C++ request -> ' + command)
      cppProcess.stdin.write(command + '\n')
    },
    py: (command) => {
      state.data.pythonWaiting = true
      console.log('Python request -> ' + command)
      pythonProcess.stdin.write(command + '\n')
    },
    rp2040: (command) => {
      if (!command.includes('DRAW')) {
        state.data.rp2040Waiting = true
      }
      console.log('RP2040 request -> ' + command)
      Rp2040Port.write(command + '\n')
    },
  }

  const commonUpdate = ({cppMsg, pythonMsg, rp2040msg}: UpdaterMsg) => {
    if (rp2040msg?.includes('PING')) {
      handlers.rp2040('DRAW_LOADING')
    }
    if (rp2040msg?.includes('READ_IMU')) {
      ReceiveReadIMUHandler({state, handlers, msg: rp2040msg})
    }
    if (rp2040msg?.includes('READ_TOF')) {
      ReceiveReadTOFHandler({state, handlers, msg: rp2040msg})
    }
    if (cppMsg?.includes('SERVOS_QUERY_POSITIONS')) {
      ReceiveServosQueryPositionsHandler({
        state,
        handlers,
        msg: cppMsg,
      })
    }
    if (cppMsg?.includes('SERVOS_QUERY_MOVING')) {
      ReceiveServosQueryMovingHandler({
        state,
        handlers,
        msg: cppMsg,
      })
    }
    if (cppMsg?.includes('SERVOS_QUERY_SPEED')) {
      ReceiveServosQuerySpeedHandler({
        state,
        handlers,
        msg: cppMsg,
      })
    }
    if (pythonMsg?.includes('READ_CAMERA')) {
      ReceiveReadCameraHandler({
        state,
        handlers,
        msg: pythonMsg,
      })
    }

    if (
      !state.data.pythonWaiting &&
      !state.data.cppWaiting &&
      !state.data.rp2040Waiting
    ) {
      const currentStateType = state.type
      switch (currentStateType) {
        case 'INIT':
          state.type = 'PINGING'
          handlers.py('PING')
          handlers.cpp('PING')
          handlers.rp2040('PING')
          break

        case 'PINGING':
          state.type = 'UNKNOWN POSITION'
          handleResetServoSettings(handlers)
          handlers.cpp('SERVOS_QUERY_POSITIONS')
          handlers.rp2040('READ_IMU')
          break

        case 'UNKNOWN POSITION':
          if (state.data.isRobotSitting) state.type = 'SITTING'

        case 'SITTING':
          console.log(isUpright(state))
          if (isUpright(state)) {
            handlers.cpp(
              makeMoveServosCommand(
                {
                  ...makeLegServoValues(200),
                  [ServoIDs.KNEE_R]: 400,
                  [ServoIDs.KNEE_L]: 400,
                },
                'SPEED',
              ),
            )
            handlers.cpp(makeMoveServosCommand(makeLegServoValues(2048)))
            state.type = 'READY'
          }

        // case 'READY':

        default:
          MoveHeadHandler({state, handlers})
          MirrorHandHandler({state, handlers})
          handlers.cpp('SERVOS_QUERY_POSITIONS')
          handlers.rp2040('READ_IMU')
          setTimeout(() => handlers.py('READ_CAMERA'), 50)
      }

      if (currentStateType !== state.type) {
        console.log('New state type -> ', state.type)
        switch (state.type) {
          case 'UNKNOWN POSITION':
            handlers.cpp(
              makeMoveServosCommand(
                {
                  [ServoIDs.HEAD_HORIZONTAL]: 100,
                  [ServoIDs.HEAD_VERTICAL]: 100,
                },
                'TORQUE',
              ),
            )
            handlers.cpp(
              makeMoveServosCommand(
                {
                  ...makeLegServoValues(200),
                  [ServoIDs.KNEE_R]: 400,
                  [ServoIDs.KNEE_L]: 400,
                },
                'SPEED',
              ),
            )
            handlers.cpp(makeMoveServosCommand(sittingPosition))
        }
      }
    }
  }

  cppProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString()
    const lines = output.split('\n')
    lines.forEach((line) => {
      if (line !== '') {
        console.log('C++ response <- ' + line)
        try {
          state.data.cppWaiting = false
          commonUpdate({cppMsg: line})
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
        console.log('Python response <- ' + line)
        try {
          state.data.pythonWaiting = false
          commonUpdate({pythonMsg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })

  Rp2040Port.on('data', (data: Buffer) => {
    const output = data.toString()
    const lines = output.split('\n')
    lines.forEach((line) => {
      if (line !== '') {
        console.log('rp2040 RESPONSE <- ', line)
        try {
          state.data.rp2040Waiting = false
          commonUpdate({rp2040msg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })
}
