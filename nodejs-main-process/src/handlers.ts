import {makeDrawEyesCommand, makeMoveServosCommand} from './commands'
import {
  MasterHandlerState,
  RawPythonReadCamMsg,
  ServoIDs,
  StdinHandlers,
  YoloDetectionResults,
} from './types'

type CameraHandlerArgs = {
  state: MasterHandlerState
  pythonMsg: string
  handlers: StdinHandlers
}

export const ReceiveReadCameraHandler = ({
  state,
  pythonMsg,
  handlers,
}: CameraHandlerArgs) => {
  const imageWidth = 1920 //  image width
  const imageHeight = 1080 //  image height
  const servoXMin = 1024
  const servoXMax = 3072
  const servoYMin = 1536
  const servoYMax = 2550

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

  const priorityObject =
    results.find((item) => item.name === 'face') ||
    results.find((item) => item.name === 'person')
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
    state.data.currentNeckHAngle = Math.max(
      Math.min(state.data.currentNeckHAngle + servoOffsetX * 0.1, servoXMax),
      servoXMin,
    )
    state.data.currentNeckVAngle = Math.max(
      Math.min(state.data.currentNeckVAngle - servoOffsetY * 0.1, servoYMax),
      servoYMin,
    )
    handlers.cpp(
      makeMoveServosCommand({
        [ServoIDs.HEAD_HORIZONTAL]: state.data.currentNeckHAngle,
        [ServoIDs.HEAD_VERTICAL]: state.data.currentNeckVAngle,
      }),
    )
  }
}
