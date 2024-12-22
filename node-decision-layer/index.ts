import {spawn} from 'child_process'

console.log('Node.js supervisor started.')

const runCppProgram = () => {
  const cppExecutable = '../cpp-hardware-control/build/cpp-hardware-control'
  const cppProcess = spawn(cppExecutable)

  cppProcess.stdout.on('data', (data: any) => {
    console.log(`C++ output: ${data}`)
  })

  cppProcess.stderr.on('data', (data: any) => {
    console.error(`C++ error: ${data}`)
  })

  cppProcess.on('close', (code: number) => {
    console.log(`C++ process exited with code ${code}`)
  })

  function sendCommandToCpp(command: string) {
    cppProcess.stdin.write(command + '\n') // Add newline to each command
  }

  sendCommandToCpp('CALLBACK PING')
  sendCommandToCpp('EXIT')
  cppProcess.stdin.end()
}

runCppProgram()

const runPythonScript = () => {
  const pythonExecutable = '../python-ml-control/venv/bin/python3'
  const pythonScript = '../python-ml-control/main.py'

  const pythonProcess = spawn(pythonExecutable, [pythonScript])

  pythonProcess.stdout.on('data', (data: any) => {
    console.log(`Python output: ${data}`)
  })

  pythonProcess.stderr.on('data', (data: any) => {
    console.error(`Python error: ${data}`)
  })

  pythonProcess.on('close', (code: number) => {
    console.log(`Python process exited with code ${code}`)
  })

  function sendCommandToPython(command: string) {
    pythonProcess.stdin.write(command + '\n') // Add newline to each command
  }

  sendCommandToPython('CALLBACK PING')
  sendCommandToPython('EXIT')
  pythonProcess.stdin.end()
}

runPythonScript()
