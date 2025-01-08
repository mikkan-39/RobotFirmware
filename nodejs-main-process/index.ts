import {spawn} from 'child_process'
import {MasterHandler} from './src/masterHandler'

console.log('Node.js supervisor started.')

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

cppProcess.on('close', (code: number) => {
  if (code !== 0) {
    throw new Error(`C++ process exited with code ${code}`)
  }
  console.log(`C++ process exited with code ${code}`)
})

pythonProcess.on('close', (code: number) => {
  if (code !== 0) {
    throw new Error(`Python process exited with code ${code}`)
  }
  console.log(`Python process exited with code ${code}`)
})

const cleanup = () => {
  // Send termination signals to the child processes
  console.log('Cleaning up...')
  pythonProcess.kill('SIGTERM')
  cppProcess.kill('SIGTERM')
  process.exit()
}

// Listen to exit signals
process.on('SIGINT', cleanup) // Handle Ctrl-C
process.on('SIGTERM', cleanup) // Handle termination
process.on('exit', cleanup) // Handle normal exit

// Main
try {
  MasterHandler(cppProcess, pythonProcess)
} catch (err) {
  console.error(err)
  cleanup()
}
