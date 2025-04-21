import {
  ReceiveReadCameraHandler,
  ReceiveReadIMUHandler,
  ReceiveReadTOFHandler,
  ReceiveServosQueryPositionsHandler,
  ReceiveServosQuerySpeedHandler,
} from './parsers'
import { MasterHandlerState } from './types'

type ProcessMsgHandlerArgs = {
  msg: any
  state: MasterHandlerState
}

export const ProcessMsgHandler = ({ msg, state }: ProcessMsgHandlerArgs) => {
  const { cppMsg, pythonMsg, rp2040msg } = msg

  if (
    rp2040msg?.includes('UNKNOWN') ||
    cppMsg?.includes('UNKNOWN') ||
    pythonMsg?.includes('UNKNOWN')
  ) {
    console.error({ cppMsg, pythonMsg, rp2040msg })
    return
  }
  if (rp2040msg?.includes('READ_IMU')) {
    ReceiveReadIMUHandler({ state, msg: rp2040msg })
  }
  if (rp2040msg?.includes('READ_TOF')) {
    ReceiveReadTOFHandler({ state, msg: rp2040msg })
  }
  if (cppMsg?.includes('SERVOS_QUERY_POSITIONS')) {
    ReceiveServosQueryPositionsHandler({
      state,
      msg: cppMsg,
    })
  }
  if (cppMsg?.includes('SERVOS_QUERY_SPEED')) {
    ReceiveServosQuerySpeedHandler({
      state,
      msg: cppMsg,
    })
  }
  if (pythonMsg?.includes('READ_CAMERA')) {
    ReceiveReadCameraHandler({
      state,
      msg: pythonMsg,
    })
  }
}
