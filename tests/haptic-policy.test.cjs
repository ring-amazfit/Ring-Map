const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadModule() {
  const filename = 'shared/haptic-policy.js'
  let code = fs.readFileSync(filename, 'utf8')
  code = code.replace(/export\s*\{[\s\S]*?\}\s*$/m, '')
  code += '\nmodule.exports = { createHapticState, evaluateHaptic }\n'
  const context = { module: { exports: {} }, exports: {}, Number, String, Math }
  vm.runInNewContext(code, context, { filename })
  return context.module.exports
}

const { createHapticState, evaluateHaptic } = loadModule()
const snap = (token, distance, action = 'turn_left') => ({
  hapticToken: token, distanceMeters: distance, action
})

let state = createHapticState()
let result = evaluateHaptic(state, 'turn', snap('s:a', 600), null, 10_000)
assert.equal(result.vibrate, true)
assert.equal(result.duration, 180)
state = result.state

result = evaluateHaptic(state, 'turn', snap('s:a', 550), snap('s:a', 600), 20_000)
assert.equal(result.vibrate, false, 'distance refresh for same instruction must not vibrate')
state = result.state

result = evaluateHaptic(state, 'proximity', snap('s:a', 490), snap('s:a', 600), 20_001)
assert.equal(result.vibrate, true, 'crossing 500m in proximity mode must vibrate once')
assert.equal(result.duration, 220)
state = result.state

result = evaluateHaptic(state, 'proximity', snap('s:a', 450), snap('s:a', 490), 30_000)
assert.equal(result.vibrate, false, 'same threshold must not repeat')

result = evaluateHaptic(state, 'turn', snap('s:b', 300), snap('s:a', 450), 20_500)
assert.equal(result.vibrate, false, 'new instruction inside cooldown is suppressed')
assert.equal(result.state.lastToken, 's:b', 'suppressed instruction still advances token')

result = evaluateHaptic(createHapticState(), 'off', snap('s:c', 80), null, 50_000)
assert.equal(result.vibrate, false)

result = evaluateHaptic(createHapticState(), 'turn', snap('s:w', 0, 'wait'), null, 50_000)
assert.equal(result.vibrate, false, 'partial wait state must never vibrate')
console.log('haptic policy tests passed')
