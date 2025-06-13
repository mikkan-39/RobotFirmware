export type MasterHandlerState = {
  type: 'INIT' | 'ERROR' | 'READY'
  data: {
    lastServoPositions: Record<number, number>
    lastServoSpeeds: Record<number, number>
    lastYoloDetectionResult: YoloDetectionResults
    lastIMUData?: any // TODO
    lastTOFData?: number
    isRobotSitting?: boolean
  }
}

export type RawPythonReadCamMsg = [
  name: string,
  coords: [xs: number, ys: number, xe: number, ye: number],
  probability: number,
][]

export type RawYoloDetectionResults = [
  string,
  [xs: number, ys: number, xe: number, ye: number],
  number
][]

export type YoloDetectionResults = {
  name: string
  coords: [xs: number, ys: number, xe: number, ye: number]
  probability: number
}[]


export const ServoIDs = {
  SHOULDER_MAIN_R: 1,
  SHOULDER_TILT_R: 3,
  ELBOW_ROTATE_R: 5,
  ELBOW_MAIN_R: 7,
  HIP_ROTATE_R: 9,
  HIP_TILT_R: 11,
  HIP_MAIN_R: 13,
  KNEE_R: 15,
  FOOT_MAIN_R: 17,
  FOOT_TILT_R: 19,

  SHOULDER_MAIN_L: 2,
  SHOULDER_TILT_L: 4,
  ELBOW_ROTATE_L: 6,
  ELBOW_MAIN_L: 8,
  HIP_ROTATE_L: 10,
  HIP_TILT_L: 12,
  HIP_MAIN_L: 14,
  KNEE_L: 16,
  FOOT_MAIN_L: 18,
  FOOT_TILT_L: 20,

  HEAD_HORIZONTAL: 21,
  HEAD_VERTICAL: 22,
} as const

export const ServoMiddle = 2048 as const
