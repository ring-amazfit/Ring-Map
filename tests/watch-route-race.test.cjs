const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadShared(file, names) {
  let code = fs.readFileSync(file, 'utf8').replace(/export\s*\{[\s\S]*?\}\s*$/m, '')
  code += `\nmodule.exports={${names.join(',')}}`
  const context = { module: { exports: {} }, exports: {}, Date, Math, Number, String, Boolean, Object, Array, isFinite }
  vm.runInNewContext(code, context, { filename: file })
  return context.module.exports
}

const nav = loadShared('shared/nav-state.js', ['createNavState','reduceNavPacket','expireNavState'])
const haptic = loadShared('shared/haptic-policy.js', ['createHapticState','evaluateHaptic'])
const timers = []
const pushes = []
let appDefinition
let builderInstance

class FakeMessageBuilder {
  constructor() { this.handlers = {}; builderInstance = this }
  on(type, callback) { this.handlers[type] = callback }
  connect(callback) { callback() }
  call() {}
  buf2Json(value) { return value }
  disConnect() {}
}

const storage = new Map()
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null },
  setItem(key, value) { storage.set(key, String(value)) },
  removeItem(key) { storage.delete(key) }
}

let code = fs.readFileSync('app.js', 'utf8').replace(/^import .*$/gm, '')
code = `var MessageBuilder=globalThis.__MessageBuilder;
var createNavState=globalThis.__nav.createNavState;
var reduceNavPacket=globalThis.__nav.reduceNavPacket;
var expireNavState=globalThis.__nav.expireNavState;
var createHapticState=globalThis.__haptic.createHapticState;
var evaluateHaptic=globalThis.__haptic.evaluateHaptic;
var getPackageInfo=function(){};
var localStorage=globalThis.__storage;
var push=globalThis.__push;
var vibrate=function(){};
var getHapticMode=function(){return 'off'};
var ble={};
` + code
const context = {
  globalThis: null,
  __MessageBuilder: FakeMessageBuilder,
  __nav: nav,
  __haptic: haptic,
  __storage: localStorage,
  __push(value) { pushes.push(value) },
  App(value) { appDefinition = value },
  console: { log() {} },
  Date,
  Math,
  Number,
  String,
  Boolean,
  Object,
  Array,
  JSON,
  setTimeout(callback, delay) {
    timers.push({ callback, delay, cancelled: false })
    return timers.length
  },
  clearTimeout(id) {
    if (timers[id - 1]) timers[id - 1].cancelled = true
  }
}
context.globalThis = context
vm.runInNewContext(code, context, { filename: 'app.js' })
appDefinition.onCreate()

function deliver(packet) {
  builderInstance.handlers.call({ payload: packet })
}

const snapshot = {
  protocolVersion: 2,
  type: 'nav_snapshot',
  state: 'active',
  sessionId: 'session-a',
  sessionStartedAt: 1000,
  seq: 1,
  emittedAt: 1000,
  ttlMs: 45000,
  action: 'turn_left',
  hapticToken: 'session-a:left'
}
deliver(snapshot)
deliver({
  protocolVersion: 2,
  type: 'nav_end',
  sessionId: 'session-a',
  sessionStartedAt: 1000,
  seq: 2,
  emittedAt: 1001
})

for (const timer of timers) {
  if (!timer.cancelled && timer.delay <= 1500) timer.callback()
}
assert.equal(pushes.length, 0, 'navigation end must cancel a queued automatic page push')
assert.equal(appDefinition.globalData.navState.status, 'idle')
console.log('watch route race tests passed')
