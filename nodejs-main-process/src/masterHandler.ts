import type {ChildProcessWithoutNullStreams} from 'child_process'
import {MasterHandlerState, UpdaterMsg, StdinHandlers} from './types'
import {SerialPort} from 'serialport'
import {ReceiveReadCameraHandler} from './handlers'

export const MasterHandler = (
  cppProcess: ChildProcessWithoutNullStreams,
  pythonProcess: ChildProcessWithoutNullStreams,
  Rp2040Port: SerialPort,
) => {
  const handlers: StdinHandlers = {
    cpp: (command) => {
      console.log('C++ request -> ' + command)
      cppProcess.stdin.write(command + '\n')
    },
    py: (command) => {
      console.log('Python request -> ' + command)
      pythonProcess.stdin.write(command + '\n')
    },
    rp2040: (command) => {
      console.log('RP2040 request -> ' + command)
      Rp2040Port.write(command + '\n')
    },
  }

  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      cppWaiting: true,
      pythonWaiting: true,
      currentNeckHAngle: 2048,
      currentNeckVAngle: 2048,
    },
  }

  const commonUpdate = ({cppMsg, pythonMsg, rp2040msg: _}: UpdaterMsg) => {
    if (cppMsg?.includes('INIT')) {
      state.data.cppWaiting = false
    }
    if (pythonMsg?.includes('INIT')) {
      state.data.pythonWaiting = false
    }
    if (cppMsg?.includes('PING')) {
      state.data.cppWaiting = false
    }
    if (pythonMsg?.includes('PING')) {
      state.data.pythonWaiting = false
    }
    if (pythonMsg?.includes('READ_CAMERA')) {
      setTimeout(() => handlers.py('READ_CAMERA'), 100)
      ReceiveReadCameraHandler({
        state,
        pythonMsg,
        handlers,
      })
    }

    if (!state.data.pythonWaiting && !state.data.cppWaiting) {
      switch (state.type) {
        case 'INIT':
          state.type = 'PINGING'
          handlers.cpp('PING')
          handlers.cpp('SERVOS_QUERY')
          handlers.py('PING')
        case 'PINGING':
          state.type = 'READY'
          state.data.pythonWaiting = true
          handlers.py('READ_CAMERA')
      }
    }
  }

  cppProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString()
    const lines = output.split('\n')
    lines.forEach((line) => {
      if (line !== '') {
        console.log('C++ response <- : ' + line)
        try {
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
        console.log('Python response <- : ' + line)
        try {
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
        console.log('rp2040 RESPONSE <-', line)
        try {
          commonUpdate({rp2040msg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })
}
