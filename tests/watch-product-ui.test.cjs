const assert = require('node:assert/strict')
const fs = require('node:fs')

const config = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const home = fs.readFileSync('page/home.js', 'utf8')
const navigation = fs.readFileSync('page/navigation.js', 'utf8')
const settings = fs.readFileSync('page/settings.js', 'utf8')
const about = fs.readFileSync('page/about.js', 'utf8')
const icons = fs.readFileSync('utils/icons.js', 'utf8')
const app = fs.readFileSync('app.js', 'utf8')
const haptic = fs.readFileSync('shared/haptic-policy.js', 'utf8')

function pngInfo(file) {
  const data = fs.readFileSync(file)
  assert.ok(data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `not PNG: ${file}`)
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data.readUInt8(25) }
}

assert.equal(config.app.version.name, '3.0.0')
assert.equal(config.app.version.code, 9)
assert.ok(home.includes("src: 'night-corridor-bg.png'"), 'home must use the original night corridor artwork')
assert.ok(home.includes('appData.markApplied(nav)'), 'home must acknowledge snapshots after its widgets are applied')
assert.ok(navigation.includes("src: 'night-corridor-bg.png'"), 'navigation must use the corridor artwork')
assert.ok(navigation.includes('appData.markApplied(nav)'), 'navigation must emit applied ACK after widget updates')
assert.ok(!navigation.includes('PROGRESS_Y'), 'navigation must not show a fake progress bar')
assert.ok(navigation.includes('ARROW_Y = 100') && navigation.includes('DISTANCE_Y = 246'), 'arrow and distance slots must be non-overlapping')
assert.ok(settings.includes('getHapticMode') && settings.includes('setHapticMode'), 'settings must expose haptic modes')
assert.ok(settings.includes('requestLatestNav'), 'settings must expose manual resync')
assert.ok(about.includes("src: 'github-qr.png'"), 'watch About must render the repository QR')
assert.ok(about.includes('3.0.0'), 'watch About must show the release version')
assert.ok(app.includes('evaluateHaptic') && haptic.includes('hapticToken'), 'global watch app must deduplicate haptics by semantic token')
assert.ok(app.includes('markApplied'), 'global watch app must support applied acknowledgements')

const actions = [
  'straight','turn_left','turn_right','slight_left','slight_right','forward_left','forward_right',
  'back_left','back_right','uturn_left','uturn_right','sharp_left','sharp_right','keep_left','keep_right',
  'roundabout_enter','roundabout_exit','merge_left','merge_right','fork_left','fork_right',
  'exit_left','exit_right','arrive','reroute','wait'
]
for (const action of actions) {
  assert.ok(icons.includes(action), `action map missing ${action}`)
}
for (const [target, value] of Object.entries(config.targets)) {
  const width = value.designWidth
  const appIcon = pngInfo(`assets/${target}/icon.png`)
  assert.equal(appIcon.width, 248, `${target} app icon width`)
  assert.equal(appIcon.height, 248, `${target} app icon height`)
  assert.equal(appIcon.colorType, 6, `${target} app icon must be transparent outside its circle`)
  const bg = pngInfo(`assets/${target}/night-corridor-bg.png`)
  assert.equal(bg.width, width, `${target} background width`)
  assert.equal(bg.height, width, `${target} background height`)
  const qr = pngInfo(`assets/${target}/github-qr.png`)
  assert.ok(qr.width === (width === 466 ? 172 : 176), `${target} QR width`)
  for (const action of actions) {
    const info = pngInfo(`assets/${target}/nav-${action.replaceAll('_','-')}.png`)
    assert.equal(info.width, 128, `${target}/${action} width`)
    assert.equal(info.height, 128, `${target}/${action} height`)
    assert.equal(info.colorType, 6, `${target}/${action} must retain RGBA`)
  }
}
console.log('watch 3.0 product UI tests passed')
