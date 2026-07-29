const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const sockets = []
const timers = []
const messageCalls = []
let service
let deviceCallHandler
let now = 100_000

class FakeWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.sent = []
    sockets.push(this)
  }

  send(value) {
    this.sent.push(value)
  }

  close() {
    this.readyState = 3
  }
}

class FakeMessageBuilder {
  listen() {}
  on(name, callback) {
    if (name === 'call') deviceCallHandler = callback
  }
  call(value) { messageCalls.push(JSON.parse(JSON.stringify(value))) }
  buf2Json(value) { return value }
}

const storage = {
  values: new Map(),
  setItem(key, value) { this.values.set(key, value) },
  getItem(key) { return this.values.get(key) },
  removeItem(key) { this.values.delete(key) }
}

let code = fs.readFileSync('app-side/index.js', 'utf8')
code = code.replace(
  /import\s*\{\s*MessageBuilder\s*\}\s*from\s*['"][^'"]+['"]\s*/,
  'var MessageBuilder = globalThis.__MessageBuilder\n'
)
code += '\nglobalThis.__handleProtocolPacket = handleProtocolPacket\n'

const context = {
  globalThis: null,
  __MessageBuilder: FakeMessageBuilder,
  WebSocket: FakeWebSocket,
  AppSideService(value) { service = value },
  settings: { settingsStorage: storage },
  localStorage: storage,
  Uint8Array,
  Date: { now: () => now },
  Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
  JSON,
  String,
  console: { log() {} },
  setTimeout(callback, delay) {
    timers.push({ callback, delay, cancelled: false })
    return timers.length
  },
  clearTimeout(id) {
    if (timers[id - 1]) timers[id - 1].cancelled = true
  }
}
storage.setItem('_rm_nav_packet', JSON.stringify({
  protocolVersion: 2,
  type: 'nav_snapshot',
  sessionId: 'cached-session',
  sessionStartedAt: 50_000,
  seq: 7,
  emittedAt: 60_000,
  ttlMs: 45_000
}))
storage.setItem('_rm_nav_packet_at', '60000')

context.globalThis = context
vm.runInNewContext(code, context, { filename: 'app-side/index.js' })

assert.ok(service, 'App-Side service must register')
service.onInit()
assert.equal(sockets.length, 1, 'onInit creates one socket')
service.onRun()
assert.equal(sockets.length, 1, 'onRun while CONNECTING must not create a second socket')

const first = sockets[0]
first.readyState = 1
first.onopen()
assert.ok(deviceCallHandler, 'device message bridge must register a call handler')
deviceCallHandler({ payload: { protocolVersion: 2, type: 'resync', emittedAt: now } })
const cachedReplay = messageCalls.find((packet) => packet.type === 'nav_snapshot')
assert.equal(cachedReplay.ttlMs, 5_000, 'cached replay must carry only its remaining TTL')
now += 1
const replayCount = messageCalls.filter((packet) => packet.type === 'nav_snapshot').length
deviceCallHandler({ payload: { protocolVersion: 2, type: 'resync', emittedAt: now } })
assert.equal(
  messageCalls.filter((packet) => packet.type === 'nav_snapshot').length,
  replayCount,
  'cache with less than five seconds remaining must not be replayed'
)
const liveStart = messageCalls.length
context.__handleProtocolPacket({
  protocolVersion: 2,
  type: 'nav_snapshot',
  sessionId: 'live-session',
  sessionStartedAt: now - 50_000,
  seq: 1,
  emittedAt: now - 44_000,
  ttlMs: 45_000
})
const liveSnapshot = messageCalls.slice(liveStart).find((packet) => packet.type === 'nav_snapshot')
assert.ok(liveSnapshot, 'a newly received live snapshot must be forwarded with at least one second remaining')
assert.equal(liveSnapshot.ttlMs, 1_000, 'a live near-expiry snapshot must carry its exact remaining TTL')
first.readyState = 3
first.onclose()
assert.equal(timers.filter((timer) => !timer.cancelled).length, 1, 'close schedules one reconnect timer')

const reconnect = timers.find((timer) => !timer.cancelled)
reconnect.callback()
assert.equal(sockets.length, 2, 'reconnect timer creates exactly one replacement socket')

const second = sockets[1]
second.readyState = 1
second.onopen()
service.onRun()
assert.equal(sockets.length, 2, 'a freshly confirmed socket must not be replaced on resume')
now += 16_000
service.onRun()
assert.equal(sockets.length, 3, 'resuming a stale App-Side transport must replace a half-open socket immediately')

const third = sockets[2]
third.readyState = 1
third.onopen()
let heartbeat = timers.findLast((timer) => !timer.cancelled && timer.delay === 10000)
heartbeat.cancelled = true
heartbeat.callback()
now += 16_000
heartbeat = timers.findLast((timer) => !timer.cancelled && timer.delay === 10000)
heartbeat.cancelled = true
heartbeat.callback()
const heartbeatRecovery = timers.findLast((timer) => !timer.cancelled && timer.delay === 1000)
assert.ok(heartbeatRecovery, 'missing pong must schedule a bounded reconnect')
heartbeatRecovery.cancelled = true
heartbeatRecovery.callback()
assert.equal(sockets.length, 4, 'heartbeat timeout creates one replacement socket')

const timerCount = timers.filter((timer) => !timer.cancelled).length
first.onclose()
assert.equal(
  timers.filter((timer) => !timer.cancelled).length,
  timerCount,
  'a stale socket callback must not schedule another reconnect'
)

service.onDestroy()
console.log('app-side single connection tests passed')
