import {spawn} from 'child_process'
import {MasterHandler} from './src/masterHandler'
import {SerialPort} from 'serialport'
console.log('Node.js supervisor started.')

const RP2040Port = new SerialPort({
  path: '/dev/ttyAMA0',
  baudRate: 115200,
})

const cppExecutable = '../cpp-hardware-control/build/cpp-hardware-control'
const pythonExecutable = '../python-ml-control/venv/bin/python3'
const pythonScript = '../python-ml-control/main.py'

const cppProcess = spawn(cppExecutable)
const pythonProcess = spawn(pythonExecutable, ['-u', pythonScript])

cppProcess.stdout.setEncoding('utf8')
pythonProcess.stdout.setEncoding('utf8')

cppProcess.stderr.on('data', (data: Buffer) => {
  console.error(`C++ stderr: \n${data}`)
})

pythonProcess.stderr.on('data', (data: Buffer) => {
  console.error(`Python stderr: \n${data}\n`)
})

const cleanup = () => {
  // Send termination signals to the child processes
  console.log('Cleaning up...')
  pythonProcess.kill('SIGTERM')
  cppProcess.kill('SIGTERM')
  RP2040Port.write('DRAW_INIT\n') // Resetting RP2040 state
  process.exit()
}

cppProcess.on('close', (code: number) => {
  if (code !== 0) {
    throw new Error(`C++ process exited with code ${code}`)
  }
  console.log(`C++ process exited with code ${code}`)
  cleanup()
})

pythonProcess.on('close', (code: number) => {
  if (code !== 0) {
    throw new Error(`Python process exited with code ${code}`)
  }
  console.log(`Python process exited with code ${code}`)
  cleanup()
})

// Listen to exit signals
process.on('SIGINT', cleanup) // Handle Ctrl-C
process.on('SIGTERM', cleanup) // Handle termination
process.on('exit', cleanup) // Handle normal exit

// Main
try {
  MasterHandler(cppProcess, pythonProcess, RP2040Port)
} catch (err) {
  console.error(err)
  cleanup()
}
