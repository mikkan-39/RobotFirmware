import { MasterHandlerState, ServoIDs, ServoMiddle } from './types'
import {
  convertToNumberRecord,
  makeGlobalServoValues,
  sittingPosition,
} from './utils'

let eyesR = 90
let eyesS = 3

setInterval(() => {
  if (Math.random() > 0.5) {
    eyesR = 10
    eyesS = 20
    setTimeout(() => {
      eyesR = 90
    }, 150)
    setTimeout(() => {
      eyesS = 3
    }, 300)
  }
}, 3000)

export const MoveHeadHandler = ({ state }: CommonHandlerArgs) => {
  const imageWidth = 1920 //  camera width
  const imageHeight = 1080 //  camera height
  const servoXMin = 1024
  const servoXMax = 3072
  const servoYMin = 1536
  const servoYMax = 2550

  const { lastServoPositions, lastYoloDetectionResult } = state.data

  const persons = lastYoloDetectionResult
    ?.filter((item) => item.name === 'person')
    ?.sort((a, b) => {
      const aSize = (a.coords[2] - a.coords[0]) * (a.coords[3] - a.coords[1])
      const bSize = (b.coords[2] - b.coords[0]) * (b.coords[3] - b.coords[1])
      return aSize - bSize
    })

  const priorityObject = persons?.pop()

  if (!priorityObject) {
    handlers.rp2040(makeDrawEyesCommand({ radius: 75, speed: 1 }))
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
      radius: eyesR,
      x: (120 - 120 * offsetX * 0.75).toFixed(),
      y: (120 + 120 * offsetY * 0.75).toFixed(),
      speed: eyesS,
    }),
  )

  if (Math.abs(offsetX) > 0.4 || Math.abs(offsetY) > 0.1) {
    let currentNeckHAngle =
      lastServoPositions?.[ServoIDs.HEAD_HORIZONTAL] ?? ServoMiddle
    let currentNeckVAngle =
      lastServoPositions?.[ServoIDs.HEAD_VERTICAL] ?? ServoMiddle

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

export const handleResetServoSettings = (handlers: StdinHandlers) => {
  // handlers.cpp(makeMoveServosCommand(makeGlobalServoValues(0), 'ACCELERATION'))
  console.log('yeet')
  handlers.cpp(makeMoveServosCommand(makeGlobalServoValues(0), 'TORQUE'))
  handlers.cpp(makeMoveServosCommand(makeGlobalServoValues(0), 'SPEED'))
}

export const MirrorHandHandler = ({ state, handlers }: CommonHandlerArgs) => {
  const positions = state.data.lastServoPositions
  handlers.cpp(
    makeMoveServosCommand({
      [ServoIDs.SHOULDER_MAIN_R]:
        4096 - (positions?.[ServoIDs.SHOULDER_MAIN_L] ?? 2048),
      [ServoIDs.SHOULDER_TILT_R]:
        4096 - (positions?.[ServoIDs.SHOULDER_TILT_L] ?? 2048),
      [ServoIDs.ELBOW_MAIN_R]:
        4096 - (positions?.[ServoIDs.ELBOW_MAIN_L] ?? 2048),
      [ServoIDs.ELBOW_ROTATE_R]:
        4096 - (positions?.[ServoIDs.ELBOW_ROTATE_L] ?? 2048),
    }),
  )
}

export const StandUpHandler = ({ handlers }: CommonHandlerArgs) => {
  handlers.cpp(makeMoveServosCommand(convertToNumberRecord(sittingPosition)))
}
