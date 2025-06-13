import { BackboneRequestHandler } from './handlers/backboneRequestHandler'
import { PeripheryRequestHandler } from './handlers/peripheryRequestHandler'
import { MasterHandlerState, RawYoloDetectionResults, ServoIDs, ServoMiddle } from './types'
import {
  convertToNumberRecord,
  makeGlobalServoValues,
  sittingPosition,
} from './utils'

export const MoveHeadHandler = async (backboneController: BackboneRequestHandler, peripheryController: PeripheryRequestHandler, rawYoloDetectionResults: RawYoloDetectionResults, lastServoPositions: Record<number, number>) => {
  const imageWidth = 1920 //  camera width
  const imageHeight = 1080 //  camera height
  const servoXMin = 1024
  const servoXMax = 3072
  const servoYMin = 1536
  const servoYMax = 2550

  const persons = rawYoloDetectionResults
    ?.filter((item) => item[0] === 'person')
    ?.sort((a, b) => {
      const aSize = (a[1][2] - a[1][0]) * (a[1][3] - a[1][1])
      const bSize = (b[1][2] - b[1][0]) * (b[1][3] - b[1][1])
      return aSize - bSize
    })

  const priorityObject = persons?.pop()

  if (!priorityObject) {
    // await peripheryController.drawEyes({ radius: 75, speed: 1 })
    return;
  }

  const priorityObjectX =
    (priorityObject[1][2] + priorityObject[1][0]) / 2
  const priorityObjectY =
    (priorityObject[1][3] + priorityObject[1][1]) / 2
  const offsetX = (priorityObjectX / imageWidth - 0.5) * 2
  const offsetY = (priorityObjectY / imageHeight - 0.5) * 2
  const servoOffsetX = offsetX * (servoXMax - servoXMin)
  const servoOffsetY = offsetY * (servoYMax - servoYMin)


  if (Math.abs(offsetX) > 0.4 || Math.abs(offsetY) > 0.1) {
    let currentNeckHAngle =
      lastServoPositions?.[ServoIDs.HEAD_HORIZONTAL] ?? ServoMiddle
    let currentNeckVAngle =
      lastServoPositions?.[ServoIDs.HEAD_VERTICAL] ?? ServoMiddle

    currentNeckHAngle = Math.max(
      Math.min(currentNeckHAngle + servoOffsetX * 0.3, servoXMax),
      servoXMin,
    )
    currentNeckVAngle = Math.max(
      Math.min(currentNeckVAngle - servoOffsetY * 0.3, servoYMax),
      servoYMin,
    )
    await backboneController.setPos({
      [ServoIDs.HEAD_HORIZONTAL]: Math.round(currentNeckHAngle),
      [ServoIDs.HEAD_VERTICAL]: Math.round(currentNeckVAngle),
    })

    await peripheryController.drawEyes({
      x: Math.round(120 - 120 * offsetX * 0.75),
      y: Math.round(120 + 120 * offsetY * 0.75),
    })
  }
}

// export const handleResetServoSettings = async (handlers: StdinHandlers) => {
//   // handlers.cpp(makeMoveServosCommand(makeGlobalServoValues(0), 'ACCELERATION'))
//   console.log('yeet')
//   handlers.cpp(makeMoveServosCommand(makeGlobalServoValues(0), 'TORQUE'))
//   handlers.cpp(makeMoveServosCommand(makeGlobalServoValues(0), 'SPEED'))
// }

// export const MirrorHandHandler = ({ state, handlers }: CommonHandlerArgs) => {
//   const positions = state.data.lastServoPositions
//   handlers.cpp(
//     makeMoveServosCommand({
//       [ServoIDs.SHOULDER_MAIN_R]:
//         4096 - (positions?.[ServoIDs.SHOULDER_MAIN_L] ?? 2048),
//       [ServoIDs.SHOULDER_TILT_R]:
//         4096 - (positions?.[ServoIDs.SHOULDER_TILT_L] ?? 2048),
//       [ServoIDs.ELBOW_MAIN_R]:
//         4096 - (positions?.[ServoIDs.ELBOW_MAIN_L] ?? 2048),
//       [ServoIDs.ELBOW_ROTATE_R]:
//         4096 - (positions?.[ServoIDs.ELBOW_ROTATE_L] ?? 2048),
//     }),
//   )
// }

// export const StandUpHandler = ({ handlers }: CommonHandlerArgs) => {
//   handlers.cpp(makeMoveServosCommand(convertToNumberRecord(sittingPosition)))
// }
