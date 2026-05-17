/**
 * Quick addon smoke test (same stack as production).
 *
 * Cross-check vs Python: see tests/run_model_node.mjs + tests/run_model_torch.py
 *
 * Usage (from nodejs-main-process/):
 *   node model_test.js
 *   node model_test.js tests/fixture_obs.json
 */
const path = require('path')
const fs = require('fs')

const addon = require('./build/Release/JSClang.node')

const obsPath = process.argv[2] || path.join(__dirname, 'tests', 'fixture_obs.json')
const obs = JSON.parse(fs.readFileSync(obsPath, 'utf8'))

addon.loadModel(path.join(__dirname, 'policy.pt'))
const output = addon.runModel(obs)

console.log('obs_path:', obsPath)
console.log('obs_len:', obs.length)
console.log('output:', output)
