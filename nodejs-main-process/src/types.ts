export type MasterHandlerState = {
  type: 'INIT' | 'PINGING' | 'READY' | 'SITTING'
  data: {
    cppWaiting: boolean
    pythonWaiting: boolean
    rp2040Waiting: boolean
    lastServoPositions?: Record<number, number>
    lastServoMoving?: Record<number, boolean>
    lastServoSpeeds?: Record<number, number>
    lastYoloDetectionResult?: YoloDetectionResults
    lastIMUData?: IMUData
    lastTOFData?: number
  }
}

export type CppStdinMsg =
  | 'PING'
  | 'SERVOS_QUERY_POSITIONS'
  | 'SERVOS_QUERY_MOVING'
  | 'SERVOS_QUERY_SPEED'
  | 'EXIT'
  | `SET_SERVO_POS${string}`
export type CppStdinHandler = (msg: CppStdinMsg) => void

export type PythonStdinMsg = 'PING' | 'READ_CAMERA' | 'EXIT'
export type PythonStdinHandler = (msg: PythonStdinMsg) => void

export type RP2040PortMsg =
  | 'PING'
  | 'DRAW_INIT'
  | 'READ_TOF'
  | 'READ_IMU'
  | 'DRAW_LOADING'
  | 'DRAW_ERROR'
  | `DRAW_EYES${string}`
export type RP2040PortHandler = (msg: RP2040PortMsg) => void

export type StdinHandlers = {
  cpp: CppStdinHandler
  py: PythonStdinHandler
  rp2040: RP2040PortHandler
}

export type UpdaterMsg = {
  cppMsg?: string
  pythonMsg?: string
  rp2040msg?: string
}

export type RawPythonReadCamMsg = [
  name: string,
  coords: [xs: number, ys: number, xe: number, ye: number],
  probability: number,
][]

export type YoloDetectionResults = {
  name: string
  coords: [xs: number, ys: number, xe: number, ye: number]
  probability: number
}[]

export const DrawEyesArgsEnum = {
  x: 'x',
  y: 'y',
  radius: 'r',
  speed: 's',
  primaryColor: 'p',
  reserveColor: 'u',
  secondaryColor: 'c',
  backgroundColor: 'b',
} as const

export type DrawEyesArgs = Partial<
  Record<keyof typeof DrawEyesArgsEnum, number | string>
>

export type IMUData = {
  roll: number
  pitch: number
  yaw: number
  gx: number
  gy: number
  gz: number
  ax: number
  ay: number
  az: number
}

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
  HIP_TILT_L: 14,
  HIP_MAIN_L: 12,
  KNEE_L: 16,
  FOOT_MAIN_L: 18,
  FOOT_TILT_L: 20,

  HEAD_HORIZONTAL: 21,
  HEAD_VERTICAL: 22,
} as const

export const ServoMiddle = 2048 as const
