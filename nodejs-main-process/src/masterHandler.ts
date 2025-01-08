import type {ChildProcessWithoutNullStreams} from 'child_process'
import {
  MasterHandlerState,
  RawPythonReadCamMsg,
  UpdaterMsg,
  YoloDetectionResults,
} from './types'

const imageWidth = 1920 //  image width
const imageHeight = 1080 //  image height
const servoMin = 1024
const servoMax = 3072

export const MasterHandler = (
  cppProcess: ChildProcessWithoutNullStreams,
  pythonProcess: ChildProcessWithoutNullStreams,
) => {
  const sendToCpp = (command: string) => {
    console.log('C++ request -> ' + command)
    cppProcess.stdin.write(command + '\n')
  }

  const sendToPython = (command: string) => {
    console.log('Python request -> ' + command)
    pythonProcess.stdin.write(command + '\n')
  }

  const state: MasterHandlerState = {
    type: 'INIT',
    data: {
      pythonQueue: [],
      cppQueue: [],
      cppWaiting: true,
      pythonWaiting: true,
      currentNeckHAngle: 2048,
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
      // Extract the part after the colon
      const dataString = pythonMsg.split(': ')[1]
      if (!dataString) {
        throw new Error('Python parsing error')
      }
      // Preprocess the string: replace single quotes and convert tuples to arrays
      const jsonString = dataString
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/\(([^)]+)\)/g, '[$1]') // Replace tuples with arrays

      // Parse the JSON string into a JavaScript array
      const results = (JSON.parse(jsonString) as RawPythonReadCamMsg).reduce(
        (acc: YoloDetectionResults, [name, [xs, ys, xe, ye], probability]) => {
          acc.push({name, coords: [xs, ys, xe, ye], probability})
          return acc
        },
        [],
      )
      state.data.lastYoloDetectionResult = results

      const firstPerson = results.find((item) => item.name === 'person')
      if (!firstPerson) {
        return
      }
      const firstPersonX = (firstPerson.coords[2] - firstPerson.coords[0]) / 2
      const firstPersony = (firstPerson.coords[3] - firstPerson.coords[1]) / 2
      const servoOffset = (firstPersonX / imageWidth) * (servoMax - servoMin)
      console.log({servoOffset})

      if (Math.abs(servoOffset) > 100) {
        console.log('move head')
      }
      setTimeout(() => sendToPython('READ_CAMERA'), 100)
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
        console.log('C++ msg: ' + line)
        commonUpdate({cppMsg: line})
      }
    })
  })

  pythonProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString()
    const lines = output.split('\n')
    lines.forEach((line) => {
      if (line !== '') {
        state.data.pythonQueue.push(line)
        console.log('Python msg: ' + line)
        commonUpdate({pythonMsg: line})
      }
    })
  })
}
