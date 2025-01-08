export type MasterHandlerState = {
  type: 'INIT' | 'PINGING' | 'READY'
  data: {
    cppQueue: string[]
    pythonQueue: string[]
    cppWaiting: boolean
    pythonWaiting: boolean
    currentNeckHAngle: number
    lastYoloDetectionResult?: YoloDetectionResults
  }
}

export type UpdaterMsg = {cppMsg?: string; pythonMsg?: string}

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
