import type {ChildProcessWithoutNullStreams} from 'child_process'
import {MasterHandlerState, UpdaterMsg, StdinHandlers} from './types'
import {SerialPort} from 'serialport'
import {
  MoveHeadHandler,
  ReceiveReadCameraHandler,
  ReceiveReadIMUHandler,
  ReceiveReadTOFHandler,
  ReceiveServosQueryMovingHandler,
  ReceiveServosQueryPositionsHandler,
  ReceiveServosQuerySpeedHandler,
} from './handlers'

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
    },
  }

  const handlers: StdinHandlers = {
    cpp: (command) => {
      state.data.cppWaiting = true
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

        case 'PINGING':
          state.type = 'READY'
          handlers.cpp('SERVOS_QUERY_POSITIONS')
          handlers.rp2040('READ_IMU')

        default:
          MoveHeadHandler({state, handlers})
          handlers.cpp('SERVOS_QUERY_POSITIONS')
          handlers.py('READ_CAMERA')
          handlers.rp2040('READ_IMU')
      }

      currentStateType !== state.type &&
        console.log('New state type -> ', state.type)
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
