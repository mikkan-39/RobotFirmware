import { spawn } from 'child_process'
import { MasterHandler } from './src/masterHandler'
import { SerialPort } from 'serialport'

console.log('Node.js supervisor started.')

const HeadPort = new SerialPort({
  path: '/dev/ttyAMA0',
  baudRate: 115200,
})

const BackbonePort = new SerialPort({
  path: '/dev/ttyAMA4',
  baudRate: 921600,

})

const pythonExecutable = '../python-ml-control/venv/bin/python3'
const pythonScript = '../python-ml-control/main.py'

const pythonProcess = spawn(pythonExecutable, ['-u', pythonScript])

// pythonProcess.stderr.on('data', (data: Buffer) => {
//   console.error(`Python stderr: \n${data}\n`)
// })

// const cleanup = () => {
//   // Send termination signals to the child processes
//   console.log('Cleaning up...')
//   pythonProcess.kill('SIGTERM')
//   HeadPort.write('DRAW_INIT\n') // Resetting RP2040 state
//   BackbonePort.write('EXIT\n')
//   process.exit()
// }

// pythonProcess.on('close', (code: number) => {
//   if (code !== 0) {
//     throw new Error(`Python process exited with code ${code}`)
//   }
//   console.log(`Python process exited with code ${code}`)
//   cleanup()
// })

// // Listen to exit signals
// process.on('SIGINT', cleanup) // Handle Ctrl-C
// process.on('SIGTERM', cleanup) // Handle termination
// process.on('exit', cleanup) // Handle normal exit

// Main
try {
  MasterHandler(BackbonePort, HeadPort, pythonProcess)
} catch (err) {
  console.error(err)
  // cleanup()
}
