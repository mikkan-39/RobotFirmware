/**
 * Run the same observation through JSClang (LibTorch) as run_model_torch.py.
 *
 * Usage (from nodejs-main-process/):
 *   node tests/run_model_node.mjs
 *   node tests/run_model_node.mjs path/to/obs.json path/to/policy.pt
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const root = join(__dirname, '..')
const obsPath = process.argv[2] ?? join(__dirname, 'fixture_obs.json')
const modelPath = process.argv[3] ?? join(root, 'policy.pt')

const obs = JSON.parse(readFileSync(obsPath, 'utf8'))
if (!Array.isArray(obs)) {
  throw new Error('observation JSON must be a number[]')
}

const addon = require(join(root, 'build/Release/JSClang.node'))
addon.loadModel(modelPath)
const output = addon.runModel(obs)

const out = {
  backend: 'node_addon',
  model: modelPath,
  obs_path: obsPath,
  obs_len: obs.length,
  output,
}
console.log(JSON.stringify(out, null, 0))
