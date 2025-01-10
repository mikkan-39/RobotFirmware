import {makeDrawEyesCommand, makeMoveServosCommand} from './commands'
import {
  IMUData,
  MasterHandlerState,
  RawPythonReadCamMsg,
  ServoIDs,
  ServoMiddle,
  StdinHandlers,
  YoloDetectionResults,
} from './types'
import {isRobotSitting} from './utils'

type CommonHandlerArgs = {
  state: MasterHandlerState
  msg: string
  handlers: StdinHandlers
}

export const ReceiveReadCameraHandler = ({state, msg}: CommonHandlerArgs) => {
  const dataString = msg.replace('READ_CAMERA: ', '')
  const results = (JSON.parse(dataString) as RawPythonReadCamMsg).reduce(
    (acc: YoloDetectionResults, [name, [xs, ys, xe, ye], probability]) => {
      acc.push({name, coords: [xs, ys, xe, ye], probability})
      return acc
    },
    [],
  )
  state.data.lastYoloDetectionResult = results
}

export const ReceiveServosQueryPositionsHandler = ({
  state,
  msg,
}: CommonHandlerArgs) => {
  const dataString = msg.replace('SERVOS_QUERY_POSITIONS: ', '')
  const results = JSON.parse(dataString) as Record<number, number>
  state.data.lastServoPositions = results
  state.data.isRobotSitting = isRobotSitting(results)
}

export const ReceiveServosQueryMovingHandler = ({
  state,
  msg,
}: CommonHandlerArgs) => {
  const dataString = msg.replace('SERVOS_QUERY_MOVING: ', '')
  const results = JSON.parse(dataString) as Record<number, boolean>
  state.data.lastServoMoving = results
}

export const ReceiveServosQuerySpeedHandler = ({
  state,
  msg,
}: CommonHandlerArgs) => {
  const dataString = msg.replace('SERVOS_QUERY_SPEED: ', '')
  const results = JSON.parse(dataString) as Record<number, number>
  state.data.lastServoSpeeds = results
}

export const ReceiveReadIMUHandler = ({state, msg}: CommonHandlerArgs) => {
  const dataString = msg
    .replace('READ_IMU: ', '')
    .replace(/([a-zA-Z0-9_]+)(?=:)/g, '"$1"')
  const results = JSON.parse(dataString) as IMUData
  state.data.lastIMUData = results
}

export const ReceiveReadTOFHandler = ({state, msg}: CommonHandlerArgs) => {
  const dataString = msg
    .replace('READ_TOF: ', '')
    .replace(/([a-zA-Z0-9_]+)(?=:)/g, '"$1"')
  const results = JSON.parse(dataString) as {distance: number}
  state.data.lastTOFData = results.distance
}

export const MoveHeadHandler = ({
  state,
  handlers,
}: Omit<CommonHandlerArgs, 'msg'>) => {
  const imageWidth = 1920 //  camera width
  const imageHeight = 1080 //  camera height
  const servoXMin = 1024
  const servoXMax = 3072
  const servoYMin = 1536
  const servoYMax = 2550

  const {lastServoPositions, lastYoloDetectionResult} = state.data

  const priorityObject =
    lastYoloDetectionResult?.find((item) => item.name === 'face') ||
    lastYoloDetectionResult?.find((item) => item.name === 'person')
  if (!priorityObject) {
    handlers.rp2040(makeDrawEyesCommand({radius: 75}))
    return
  }
  const priorityObjectX =
    (priorityObject.coords[2] + priorityObject.coords[0]) / 2
  const priorityObjectY =
    (priorityObject.coords[3] + priorityObject.coords[1]) / 2
  const offsetX = (priorityObjectX / imageWidth - 0.5) * 2
  const offsetY = (priorityObjectY / imageHeight - 0.5) * 2
  const servoOffsetX = offsetX * (servoXMax - servoXMin)
  const servoOffsetY = offsetY * (servoYMax - servoYMin)

  handlers.rp2040(
    makeDrawEyesCommand({
      radius: 90,
      x: (120 - 120 * offsetX * 0.75).toFixed(),
      y: (120 + 120 * offsetY * 0.75).toFixed(),
      speed: 10,
    }),
  )

  if (Math.abs(offsetX) > 0.2 || Math.abs(offsetY) > 0.1) {
    let currentNeckHAngle =
      lastServoPositions?.[ServoIDs.HEAD_HORIZONTAL] ?? ServoMiddle
    let currentNeckVAngle =
      lastServoPositions?.[ServoIDs.HEAD_VERTICAL] ?? ServoMiddle

    console.log({currentNeckHAngle, currentNeckVAngle})

    currentNeckHAngle = Math.max(
      Math.min(currentNeckHAngle + servoOffsetX * 0.2, servoXMax),
      servoXMin,
    )
    currentNeckVAngle = Math.max(
      Math.min(currentNeckVAngle - servoOffsetY * 0.2, servoYMax),
      servoYMin,
    )
    handlers.cpp(
      makeMoveServosCommand({
        [ServoIDs.HEAD_HORIZONTAL]: currentNeckHAngle,
        [ServoIDs.HEAD_VERTICAL]: currentNeckVAngle,
      }),
    )
  }
}
