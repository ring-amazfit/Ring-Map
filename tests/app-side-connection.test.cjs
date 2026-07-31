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
const connectingWakeDeadline = timers.findLast((timer) => !timer.cancelled && timer.delay === 1500)
assert.ok(connectingWakeDeadline,
  'a wake that begins while the socket connects must start its authority deadline after onopen')
connectingWakeDeadline.cancelled = true
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
const liveDelivery = timers.findLast((timer) => !timer.cancelled && timer.delay === 80)
assert.ok(liveDelivery, 'live snapshots must use a short coalescing window before crossing the phone-watch bridge')
liveDelivery.cancelled = true
liveDelivery.callback()
const liveSnapshot = messageCalls.slice(liveStart).find((packet) => packet.type === 'nav_snapshot')
assert.ok(liveSnapshot, 'a newly received live snapshot must be forwarded with at least one second remaining')
assert.equal(liveSnapshot.ttlMs, 1_000, 'a live near-expiry snapshot must carry its exact remaining TTL')

const shortTtlStart = messageCalls.length
context.__handleProtocolPacket({
  protocolVersion: 2,
  type: 'nav_snapshot',
  sessionId: 'short-ttl-session',
  sessionStartedAt: now,
  seq: 1,
  emittedAt: now,
  ttlMs: 1000
})
const shortTtlDelivery = timers.findLast((timer) => !timer.cancelled && timer.delay === 80)
assert.ok(shortTtlDelivery, 'a valid one-second snapshot must still be delivered once')
shortTtlDelivery.cancelled = true
shortTtlDelivery.callback()
const shortTtlSnapshot = messageCalls.slice(shortTtlStart).find((packet) => packet.type === 'nav_snapshot')
assert.equal(shortTtlSnapshot.ttlMs, 1000,
  'App-Side must not extend the protocol minimum TTL from one to five seconds')

const burstStart = messageCalls.length
for (let seq = 2; seq <= 12; seq++) {
  context.__handleProtocolPacket({
    protocolVersion: 2,
    type: 'nav_snapshot',
    sessionId: 'live-session',
    sessionStartedAt: now - 50_000,
    seq,
    emittedAt: now,
    ttlMs: 45_000
  })
}
assert.equal(
  messageCalls.slice(burstStart).filter((packet) => packet.type === 'nav_snapshot').length,
  0,
  'a queued Android burst must not immediately flood the phone-watch transport'
)
const burstDelivery = timers.findLast((timer) => !timer.cancelled && timer.delay === 80)
assert.ok(burstDelivery, 'a queued Android burst must retain one coalesced delivery timer')
burstDelivery.cancelled = true
burstDelivery.callback()
const burstSnapshots = messageCalls.slice(burstStart).filter((packet) => packet.type === 'nav_snapshot')
deviceCallHandler({
  payload: {
    protocolVersion: 2,
    type: 'watch_ready',
    recoveryId: 'sleep-generation',
    watchReadyAt: now,
    emittedAt: now
  }
})
deviceCallHandler({
  payload: {
    protocolVersion: 2,
    type: 'watch_sleep',
    recoveryId: 'sleep-generation',
    watchReadyAt: now,
    emittedAt: now
  }
})
const sleepingStart = messageCalls.length
now += 25_000
context.__handleProtocolPacket({
  protocolVersion: 2,
  type: 'nav_snapshot',
  sessionId: 'live-session',
  sessionStartedAt: now - 50_000,
  seq: 13,
  emittedAt: now,
  ttlMs: 45_000
})
const sleepingDelivery = timers.findLast((timer) => !timer.cancelled && timer.delay === 80)
assert.equal(sleepingDelivery, undefined, 'an inactive watch must retain its latest snapshot without scheduling phone-watch delivery')
assert.equal(
  messageCalls.slice(sleepingStart).filter((packet) => packet.type === 'nav_snapshot').length,
  0,
  'an inactive watch must not accumulate queued navigation snapshots while it sleeps'
)
assert.equal(JSON.parse(storage.getItem('_rm_nav_packet')).seq, 13,
  'an inactive watch must persist the newest snapshot before App-Side can be reclaimed')
deviceCallHandler({
  payload: {
    protocolVersion: 2,
    type: 'watch_ready',
    recoveryId: 'awake-generation',
    watchReadyAt: now,
    emittedAt: now
  }
})
const resumedSnapshot = messageCalls.slice(sleepingStart).find((packet) => packet.type === 'nav_snapshot')
assert.ok(resumedSnapshot, 'a newly awake watch must receive the cached latest snapshot immediately')
assert.equal(resumedSnapshot.seq, 13, 'wake recovery must deliver the latest snapshot instead of a queued history')
assert.equal(
  messageCalls.slice(sleepingStart).filter((packet) => packet.type === 'nav_snapshot').length,
  1,
  'wake recovery must emit exactly one latest snapshot'
)

const delayedSleepStart = messageCalls.length
deviceCallHandler({
  payload: {
    protocolVersion: 2,
    type: 'watch_sleep',
    recoveryId: 'sleep-generation',
    watchReadyAt: now,
    emittedAt: now
  }
})
context.__handleProtocolPacket({
  protocolVersion: 2,
  type: 'nav_snapshot',
  sessionId: 'live-session',
  sessionStartedAt: now - 50_000,
  seq: 14,
  emittedAt: now,
  ttlMs: 45_000
})
const delayedSleepDelivery = timers.findLast((timer) => !timer.cancelled && timer.delay === 80)
assert.ok(delayedSleepDelivery,
  'a stale watch_sleep from a replaced generation must not suppress a live watch delivery')
delayedSleepDelivery.cancelled = true
delayedSleepDelivery.callback()
assert.equal(messageCalls.slice(delayedSleepStart).find((packet) => packet.type === 'nav_snapshot').seq, 14,
  'a wake generation must retain realtime delivery after its predecessor sleep packet arrives late')

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
const resumePacketsBefore = second.sent.length
service.onRun()
assert.equal(sockets.length, 2, 'a long screen-off gap must not force a healthy socket reconnect')
const resumePacket = JSON.parse(second.sent.at(-1))
assert.equal(resumePacket.type, 'resync')
assert.equal(resumePacket.reason, 'app_side_run')
assert.equal(second.sent.length, resumePacketsBefore + 1, 'resume must immediately request the latest navigation state')

const wakeRecovery = timers.findLast((timer) => !timer.cancelled && timer.delay === 1500)
assert.ok(wakeRecovery, 'a wake resync must have a short authority-response deadline')
context.__handleProtocolPacket({
  protocolVersion: 2,
  type: 'idle',
  stateRevision: now,
  emittedAt: now,
  recoveryId: 'unrelated-wake',
  watchReadyAt: 1
})
assert.equal(wakeRecovery.cancelled, false,
  'an unrelated authority packet must not cancel the current wake deadline')
context.__handleProtocolPacket({
  protocolVersion: 2,
  type: 'idle',
  stateRevision: now + 1,
  emittedAt: now + 1,
  recoveryId: resumePacket.recoveryId,
  watchReadyAt: resumePacket.watchReadyAt
})
assert.equal(wakeRecovery.cancelled, true,
  'only the correlated Android response may cancel the current wake deadline')
wakeRecovery.callback()
assert.equal(sockets.length, 2, 'a correlated response must keep the healthy socket')
service.onRun()
const silentWakeRecovery = timers.findLast((timer) => !timer.cancelled && timer.delay === 1500)
assert.ok(silentWakeRecovery, 'each wake must create its own correlated authority deadline')
silentWakeRecovery.cancelled = true
silentWakeRecovery.callback()
assert.equal(sockets.length, 3, 'a silent but open socket must be replaced after the wake authority deadline')

const third = sockets[2]
third.readyState = 1
third.onopen()
const active = third
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
assert.equal(sockets.length, 4, 'an actual missed heartbeat creates one replacement socket')

const timerCount = timers.filter((timer) => !timer.cancelled).length
first.onclose()
assert.equal(
  timers.filter((timer) => !timer.cancelled).length,
  timerCount,
  'a stale socket callback must not schedule another reconnect'
)

service.onDestroy()
console.log('app-side single connection tests passed')
