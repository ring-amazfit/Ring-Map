const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const sockets = []
const timers = []
let service

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
  on() {}
  call() {}
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

const context = {
  globalThis: null,
  __MessageBuilder: FakeMessageBuilder,
  WebSocket: FakeWebSocket,
  AppSideService(value) { service = value },
  settings: { settingsStorage: storage },
  localStorage: storage,
  Uint8Array,
  Date,
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
first.readyState = 3
first.onclose()
assert.equal(timers.filter((timer) => !timer.cancelled).length, 1, 'close schedules one reconnect timer')

const reconnect = timers.find((timer) => !timer.cancelled)
reconnect.callback()
assert.equal(sockets.length, 2, 'reconnect timer creates exactly one replacement socket')

const timerCount = timers.filter((timer) => !timer.cancelled).length
first.onclose()
assert.equal(
  timers.filter((timer) => !timer.cancelled).length,
  timerCount,
  'a stale socket callback must not schedule another reconnect'
)

service.onDestroy()
console.log('app-side single connection tests passed')
