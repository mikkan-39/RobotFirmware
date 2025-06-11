import * as zmq from "zeromq";

const pythonSock = new zmq.Request()
pythonSock.connect("tcp://127.0.0.1:5836")
pythonSock.sendTimeout = 5;
pythonSock.receiveTimeout = 5;

type PythonRequests = 'PING' | 'READ_CAMERA' | 'EXIT'

export const pythonRequest = async (request: PythonRequests) => {
  await pythonSock.send(JSON.stringify({ method: request }))
  const [reply] = await pythonSock.receive()
  return reply
}