const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const appSource = fs.readFileSync('app.js', 'utf8')
const appSideSource = fs.readFileSync('app-side/index.js', 'utf8')
const transportSource = fs.readFileSync('shared/message.js', 'utf8')
assert(transportSource.includes('isValidShake'), 'device transport must validate a returned Shake before declaring BLE ready')
assert(transportSource.includes('data.appId === this.appId'), 'returned Shake must match the RingMap app id')
assert(transportSource.includes('buf.byteLength < MESSAGE_HEADER'), 'truncated BLE frames must be discarded before binary reads')
assert(appSource.includes('if (builder !== next) return'), 'delayed callbacks from a replaced BLE transport must be ignored')
assert(appSource.includes('builder.notify(packet)'), 'watch_sleep must use the immediate post-handshake notify path before teardown')
assert(appSource.includes("packet.bridgeOrigin === 'android'"), 'only an Android-origin bridge state may persist watch activation')
assert(appSideSource.includes("bridgeOrigin: 'app_side'"), 'App-Side synthetic bridge status must be distinguishable from Android bridge state')

let appDefinition
let builder

class FakeMessageBuilder {
  constructor() {
    this.handlers = {}
    this.calls = []
    builder = this
  }

  on(type, callback) { this.handlers[type] = callback }
  connect() {}
  call(packet) { this.calls.push(packet) }
  notify(packet) { this.notified = packet }
  disConnect() {}
  buf2Json(value) { return value }
}

const nav = {
  createNavState() {
    return { status: 'idle', bridgeStatus: 'connecting', sessionId: '', seq: 0 }
  },
  reduceNavPacket(state) { return { state, changed: false } },
  expireNavState(state) { return { state, changed: false } }
}

let source = fs.readFileSync('app.js', 'utf8').replace(/^import .*$/gm, '')
source = `var MessageBuilder=globalThis.__MessageBuilder;
var createNavState=globalThis.__nav.createNavState;
var reduceNavPacket=globalThis.__nav.reduceNavPacket;
var expireNavState=globalThis.__nav.expireNavState;
var createHapticState=function(){return {}};
var evaluateHaptic=function(){return {state:{},vibrate:false}};
var getPackageInfo=function(){};
var localStorage=globalThis.__storage;
var push=function(){};
var vibrate=function(){};
var getHapticMode=function(){return 'off'};
var isWatchActivated=function(){return false};
var markWatchActivated=globalThis.__markWatchActivated;
var ble={};
` + source

const storage = new Map()
const context = {
  globalThis: null,
  __MessageBuilder: FakeMessageBuilder,
  __nav: nav,
  __markWatchActivated() { context.activationWrites++ },
  activationWrites: 0,
  __storage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null },
    setItem(key, value) { storage.set(key, String(value)) },
    removeItem(key) { storage.delete(key) }
  },
  App(value) { appDefinition = value },
  Date: { now: () => 100_000 },
  Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
  String, Number, Boolean, Object, Array, JSON,
  console: { log() {} },
  setTimeout() { return 1 },
  clearTimeout() {}
}
context.globalThis = context
vm.runInNewContext(source, context, { filename: 'app.js' })

appDefinition.onCreate()
assert.deepEqual(builder.calls, [], 'Device App must not send recovery packets before the BLE handshake completes')
assert.equal(typeof builder.handlers.connected, 'function', 'Device App must wait for the MessageBuilder connected event')

builder.handlers.connected()
assert.deepEqual(
  builder.calls.map((packet) => packet.type),
  ['watch_ready', 'resync'],
  'a completed BLE handshake must announce watch readiness and request Android authority state exactly once'
)
assert.ok(builder.calls.every((packet) => packet.recoveryId), 'handshake recovery packets must keep a wake correlation id')
builder.handlers.call({ payload: { protocolVersion: 2, type: 'bridge_state', status: 'connected', bridgeOrigin: 'app_side' } })
assert.equal(context.activationWrites, 0, 'a synthetic App-Side status must not activate the watch')
builder.handlers.call({ payload: { protocolVersion: 2, type: 'bridge_state', status: 'connected', bridgeOrigin: 'android' } })
assert.equal(context.activationWrites, 1, 'an Android-origin bridge status activates the watch once')
appDefinition.onDestroy()
assert.equal(builder.notified && builder.notified.type, 'watch_sleep',
  'destroy must synchronously notify App-Side about watch sleep before BLE teardown')
console.log('watch transport handshake tests passed')
