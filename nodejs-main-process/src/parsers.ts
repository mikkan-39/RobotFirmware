import {
  IMUData,
  MasterHandlerState,
  RawPythonReadCamMsg,
  YoloDetectionResults,
} from './types'
import { isRobotSitting } from './utils'

type CommonParserArgs = {
  state: MasterHandlerState
  msg: string
}

export const ReceiveReadCameraHandler = ({ state, msg }: CommonParserArgs) => {
  const dataString = msg.replace('READ_CAMERA: ', '')
  const results = (JSON.parse(dataString) as RawPythonReadCamMsg).reduce(
    (acc: YoloDetectionResults, [name, [xs, ys, xe, ye], probability]) => {
      acc.push({ name, coords: [xs, ys, xe, ye], probability })
      return acc
    },
    [],
  )
  state.data.lastYoloDetectionResult = results
}

export const ReceiveServosQueryPositionsHandler = ({
  state,
  msg,
}: CommonParserArgs) => {
  const dataString = msg.replace('SERVOS_QUERY_POSITIONS: ', '')
  const results = JSON.parse(dataString) as Record<number, number>
  state.data.lastServoPositions = { ...state.data.lastServoPositions, ...results }
  state.data.isRobotSitting = isRobotSitting(state)
}

export const ReceiveServosQuerySpeedHandler = ({
  state,
  msg,
}: CommonParserArgs) => {
  const dataString = msg.replace('SERVOS_QUERY_SPEED: ', '')
  const results = JSON.parse(dataString) as Record<number, number>
  state.data.lastServoSpeeds = { ...state.data.lastServoSpeeds, ...results }
}

export const ReceiveReadIMUHandler = ({ state, msg }: CommonParserArgs) => {
  let data: IMUData | undefined
  try {
    const dataString = msg
      .replace('READ_IMU: ', '')
      .replace(/([a-zA-Z0-9_]+)(?=:)/g, '"$1"')
    data = JSON.parse(dataString) as IMUData
  } catch (_) {
    console.error('IMU parsing error')
    console.error(msg)
    return
  }

  const convertedIMUData = {
    roll: data.pitch,
    pitch: data.roll,
    yaw: data.yaw,
    gx: -data.gx,
    gy: -data.gy,
    gz: -data.gz,
    ax: -data.ax,
    ay: -data.ay,
    az: -data.az,
  }

  state.data.lastIMUData = convertedIMUData
}

export const ReceiveReadTOFHandler = ({ state, msg }: CommonParserArgs) => {
  const dataString = msg
    .replace('READ_TOF: ', '')
    .replace(/([a-zA-Z0-9_]+)(?=:)/g, '"$1"')
  const results = JSON.parse(dataString) as { distance: number }
  state.data.lastTOFData = results.distance
}
