import type {ChildProcessWithoutNullStreams} from 'child_process'
import {
  MasterHandlerState,
  RawPythonReadCamMsg,
  UpdaterMsg,
  YoloDetectionResults,
} from './types'
import {SerialPort} from 'serialport'

const imageWidth = 1280 //  image width
const imageHeight = 960 //  image height
const servoXMin = 1024
const servoXMax = 3072
const servoYMin = 1536
const servoYMax = 2550

export const MasterHandler = (
  cppProcess: ChildProcessWithoutNullStreams,
  pythonProcess: ChildProcessWithoutNullStreams,
  headPort: SerialPort,
) => {
  const sendToCpp = (command: string) => {
    console.log('C++ request -> ' + command)
    cppProcess.stdin.write(command + '\n')
  }

  const sendToPython = (command: string) => {
    console.log('Python request -> ' + command)
    pythonProcess.stdin.write(command + '\n')
  }

  const sendToHead = (command: string) => {
    headPort.write(command + '\n')
  }

  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      pythonQueue: [],
      cppQueue: [],
      cppWaiting: true,
      pythonWaiting: true,
      currentNeckHAngle: 2048,
      currentNeckVAngle: 2048,
    },
  }

  const update = () => {
    switch (state.type) {
      case 'INIT':
        sendToCpp('PING')
        sendToPython('PING')
        state.type = 'PINGING'
        state.data.cppWaiting = true
        state.data.pythonWaiting = true
        console.log('Waiting for pings to be acknowledged.')
        break

      case 'PINGING':
        if (state.data.cppWaiting) {
          const cppResponse = state.data.cppQueue.shift()
          if (cppResponse?.includes('PING')) {
            console.log('C++ acknowledged ping.')
            state.data.cppWaiting = false
          }
        }
        if (!state.data.pythonWaiting) {
          const pythonResponse = state.data.pythonQueue.shift()
          if (pythonResponse?.includes('PING')) {
            console.log('Python acknowledged ping.')
            state.data.pythonWaiting = true
          }
        }

        if (!state.data.cppWaiting && !state.data.pythonWaiting) {
          console.log('Pings acknowledged by child processes. Ready.')
          state.type = 'READY'
        }

        break

      case 'READY':
        sendToPython('READ_CAMERA')
        break
      default:
        break
    }
  }

  const commonUpdate = ({cppMsg, pythonMsg}: UpdaterMsg) => {
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
      setTimeout(() => sendToPython('READ_CAMERA'), 50)
      // Extract the part after the colon
      const dataString = pythonMsg.split(': ')[1]
      if (!dataString) {
        throw new Error('Python parsing error')
      }

      // Parse the JSON string into a JavaScript array
      const results = (JSON.parse(dataString) as RawPythonReadCamMsg).reduce(
        (acc: YoloDetectionResults, [name, [xs, ys, xe, ye], probability]) => {
          acc.push({name, coords: [xs, ys, xe, ye], probability})
          return acc
        },
        [],
      )
      state.data.lastYoloDetectionResult = results

      const firstPerson = results.find((item) => item.name === 'person')
      if (!firstPerson) {
        sendToHead('DRAW_EYES r75')
        return
      }
      const firstPersonX = (firstPerson.coords[2] + firstPerson.coords[0]) / 2
      const firstPersonY = (firstPerson.coords[3] + firstPerson.coords[1]) / 2
      const offsetX = (firstPersonX / imageWidth - 0.5) * 2
      const offsetY = (firstPersonY / imageHeight - 0.5) * 2
      const servoOffsetX = offsetX * (servoXMax - servoXMin)
      const servoOffsetY = offsetY * (servoYMax - servoYMin)

      const headCommand = `DRAW_EYES x${(120 - 120 * offsetX * 0.75).toFixed()} y${(120 + 120 * offsetY * 0.75).toFixed()} s10 r90`
      sendToHead(headCommand)

      if (Math.abs(offsetX) > 0.2 || Math.abs(offsetY) > 0.1) {
        state.data.currentNeckHAngle = Math.max(
          Math.min(
            state.data.currentNeckHAngle + servoOffsetX * 0.1,
            servoXMax,
          ),
          servoXMin,
        )
        state.data.currentNeckVAngle = Math.max(
          Math.min(
            state.data.currentNeckVAngle - servoOffsetY * 0.1,
            servoYMax,
          ),
          servoYMin,
        )
        sendToCpp(
          `HEAD_ROTATE x=${state.data.currentNeckHAngle}  y=${state.data.currentNeckVAngle}`,
        )
      }
    }

    if (!state.data.pythonWaiting && !state.data.cppWaiting) {
      switch (state.type) {
        case 'INIT':
          state.type = 'PINGING'
          sendToCpp('PING')
          sendToPython('PING')
        case 'PINGING':
          state.type = 'READY'
          state.data.pythonWaiting = true
          sendToPython('READ_CAMERA')
      }
    }
  }

  cppProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString()
    const lines = output.split('\n')
    lines.forEach((line) => {
      if (line !== '') {
        state.data.cppQueue.push(line)
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
        state.data.pythonQueue.push(line)
        console.log('Python response <- : ' + line)
        try {
          commonUpdate({pythonMsg: line})
        } catch (err) {
          console.error(err)
        }
      }
    })
  })

  // headPort.on('data', (data) => console.log('HEAD RESPONSE ', data.toString()))
}
