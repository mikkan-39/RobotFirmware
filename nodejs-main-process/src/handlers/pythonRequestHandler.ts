import * as zmq from "zeromq";
import { RawYoloDetectionResults } from "../types";

const pythonSock = new zmq.Request()

export const connectPythonSock = () => {
  pythonSock.connectTimeout = 15000;
  pythonSock.connect("tcp://127.0.0.1:5836")
}

export const pythonSockSetTimeouts = () => {
  pythonSock.sendTimeout = 15;
  pythonSock.receiveTimeout = 15;
}

type PythonRequests = 'PING' | 'READ_CAMERA' | 'EXIT'

export const pythonRequest = async (request: PythonRequests) => {
  await pythonSock.send(JSON.stringify({ method: request }))
  const [reply] = await pythonSock.receive()
  const replyString = reply?.toString()
  return replyString ? JSON.parse(replyString) as RawYoloDetectionResults : null
}