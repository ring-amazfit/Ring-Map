const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadWatchModule() {
  const filename = 'shared/nav-state.js'
  let code = fs.readFileSync(filename, 'utf8')
  code = code.replace(/export\s*\{[\s\S]*?\}\s*$/m, '')
  code += '\nmodule.exports = { createNavState, reduceNavPacket, expireNavState }\n'
  const context = {
    module: { exports: {} },
    exports: {},
    Date,
    JSON,
    Math,
    String,
    Number,
    Boolean,
    Object,
    Array
  }
  vm.runInNewContext(code, context, { filename })
  return context.module.exports
}

const { createNavState, reduceNavPacket, expireNavState } = loadWatchModule()

function snapshot(sessionId, seq, emittedAt = 1000) {
  return {
    protocolVersion: 2,
    type: 'nav_snapshot',
    sessionId,
    seq,
    state: 'active',
    ttlMs: 45000,
    emittedAt,
    action: 'turn_left',
    distanceMeters: 200,
    distanceText: '200米',
    instruction: '前方200米左转'
  }
}

{
  let state = createNavState()
  let result = reduceNavPacket(state, snapshot('session-a', 11), 2000)
  assert.equal(result.changed, true)
  state = result.state

  result = reduceNavPacket(state, snapshot('session-a', 10), 2100)
  assert.equal(result.changed, false)
  assert.equal(result.reason, 'old_seq')
  assert.equal(result.state.seq, 11)
}

{
  let state = reduceNavPacket(createNavState(), snapshot('session-b', 1), 2000).state
  const staleEnd = {
    protocolVersion: 2,
    type: 'nav_end',
    sessionId: 'session-a',
    seq: 99,
    emittedAt: 2100
  }
  const result = reduceNavPacket(state, staleEnd, 2200)
  assert.equal(result.changed, false)
  assert.equal(result.reason, 'different_session_end')
  assert.equal(result.state.status, 'active')
  assert.equal(result.state.sessionId, 'session-b')
}

{
  let state = reduceNavPacket(createNavState(), snapshot('session-a', 2), 2000).state
  const result = reduceNavPacket(state, {
    protocolVersion: 2,
    type: 'nav_end',
    sessionId: 'session-a',
    seq: 3,
    emittedAt: 2500
  }, 2600)
  assert.equal(result.changed, true)
  assert.equal(result.state.status, 'idle')
  assert.equal(result.state.snapshot, null)
  assert.equal(result.state.sessionId, 'session-a', 'ended session must remain as a tombstone')

  const replay = reduceNavPacket(result.state, snapshot('session-a', 2, 1000), 2700)
  assert.equal(replay.changed, false, 'ended session must not be revived by a delayed snapshot')
  assert.match(replay.reason, /old_/)
}

{
  const active = reduceNavPacket(createNavState(), snapshot('session-new', 1, 3000), 3100).state
  const oldIdle = reduceNavPacket(active, {
    protocolVersion: 2,
    type: 'idle',
    emittedAt: 2000
  }, 3200)
  assert.equal(oldIdle.changed, false, 'an older idle packet must not clear active navigation')
  assert.equal(oldIdle.reason, 'old_authority')
  assert.equal(oldIdle.state.status, 'active')

  const currentIdle = reduceNavPacket(active, {
    protocolVersion: 2,
    type: 'idle',
    emittedAt: 4000
  }, 4100)
  assert.equal(currentIdle.changed, true)
  assert.equal(currentIdle.state.status, 'idle')
  assert.equal(currentIdle.state.sessionId, 'session-new')
}

{
  let state = reduceNavPacket(createNavState(), snapshot('session-a', 1), 1000).state
  let result = expireNavState(state, 46000)
  assert.equal(result.changed, false, 'TTL is measured from watch receipt, not phone clock')

  result = expireNavState(state, 47001)
  assert.equal(result.changed, true)
  assert.equal(result.state.status, 'stale')
  assert.equal(result.state.snapshot, null, 'stale state must not keep rendering an old maneuver')
  assert.equal(result.state.sessionId, 'session-a')

  const renewed = reduceNavPacket(result.state, snapshot('session-a', 1), 48000)
  assert.equal(renewed.changed, true, 'authority may renew the exact stale snapshot')
  assert.equal(renewed.reason, 'renewed_snapshot')
  assert.equal(renewed.state.status, 'active')
  assert.equal(renewed.state.seq, 1)
}

{
  const active = reduceNavPacket(createNavState(), snapshot('session-a', 4), 2000).state
  const unversionedIdle = reduceNavPacket(active, { type: 'idle' }, 2100)
  assert.equal(unversionedIdle.changed, false)
  assert.equal(unversionedIdle.reason, 'unsupported_protocol')
  assert.equal(unversionedIdle.state.status, 'active')
}

{
  const state = reduceNavPacket(createNavState(), snapshot('session-a', 4), 2000).state
  const duplicate = reduceNavPacket(state, snapshot('session-a', 4), 2100)
  assert.equal(duplicate.changed, false)
  assert.equal(duplicate.reason, 'old_seq')
}

{
  const nearExpiry = snapshot('session-live', 1, 1000)
  nearExpiry.ttlMs = 1000
  const result = reduceNavPacket(createNavState(), nearExpiry, 5000)
  assert.equal(result.changed, true)
  assert.equal(result.state.expiresAt, 6000, 'forwarded live packets must retain sub-five-second remaining TTL')
}

console.log('watch protocol reducer tests passed')
