const assert = require('node:assert/strict')
const fs = require('node:fs')

const config = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const home = fs.readFileSync('page/home.js', 'utf8')
const navigation = fs.readFileSync('page/navigation.js', 'utf8')
const settings = fs.readFileSync('page/settings.js', 'utf8')
const themePage = fs.readFileSync('page/theme.js', 'utf8')
const about = fs.readFileSync('page/about.js', 'utf8')
const icons = fs.readFileSync('utils/icons.js', 'utf8')
const theme = fs.readFileSync('utils/theme.js', 'utf8')
const screenSettings = fs.readFileSync('utils/settings.js', 'utf8')
const app = fs.readFileSync('app.js', 'utf8')
const haptic = fs.readFileSync('shared/haptic-policy.js', 'utf8')

function pngInfo(file) {
  const data = fs.readFileSync(file)
  assert.ok(data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `not PNG: ${file}`)
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data.readUInt8(25) }
}

assert.equal(config.app.version.name, '3.0.1')
assert.equal(config.app.version.code, 13)
assert.ok(home.includes('drawThemeBackground'), 'home must render the selected watch theme background')
assert.ok(home.includes('appData.markApplied(nav)'), 'home must acknowledge snapshots after its widgets are applied')
assert.ok(navigation.includes('drawThemeBackground'), 'navigation must render the selected watch theme background')
assert.ok(navigation.includes('appData.markApplied(nav)'), 'navigation must emit applied ACK after widget updates')
assert.ok(!navigation.includes('PROGRESS_Y'), 'navigation must not show a fake progress bar')
assert.ok(navigation.includes('ARROW_Y = 88') && navigation.includes('ARROW_SIZE = 152') && navigation.includes('DISTANCE_Y = 246'), 'larger arrow and distance slots must remain non-overlapping')
assert.ok(home.includes("if (type === 'wait') return") && navigation.includes('clearArrow'), 'watch waiting and connection states must be text-only')
assert.ok(settings.includes('getHapticMode') && settings.includes('setHapticMode'), 'settings must expose haptic modes')
assert.ok(settings.includes('widget.SLIDE_SWITCH') && settings.includes('checked_change_func'), 'binary settings must use native stateful switches')
assert.ok(!settings.includes('slide_y:'), 'native switch must use the platform default vertical centering')
assert.ok(!settings.includes('setToggle('), 'settings must not rely on BUTTON.setProperty to refresh binary state')
assert.ok(settings.includes("page/theme"), 'settings must expose the three-theme picker')
assert.ok(theme.includes("'corridor'") && theme.includes("'black'") && theme.includes("'anime'"), 'watch themes must include corridor, black, and anime variants')
assert.ok(theme.includes("return '导航娘'") && themePage.includes("title: '导航娘'"), 'the character theme must be named 导航娘 everywhere users see it')
assert.ok(!themePage.includes("title: '二次元'"), 'the old generic theme name must not remain in the picker')
assert.ok(themePage.includes('deleteWidget(current)') && themePage.includes('renderThemeButtons'), 'theme selection must recreate buttons so the selected state updates immediately')
assert.ok(!/setProperty\(prop\.MORE,\s*\{\s*normal_color/.test(themePage), 'BUTTON.setProperty must not be used for theme selection colors')
assert.ok(config.targets.balance.module.page.pages.includes('page/theme'), 'every target must package the theme picker')
assert.ok(!settings.includes('重新同步'), 'watch recovery must be automatic instead of exposing a manual restart control')
assert.ok(about.includes("src: 'github-qr.png'"), 'watch About must render the repository QR')
assert.ok(about.includes('3.0.1'), 'watch About must show the release version')
assert.ok(app.includes('evaluateHaptic') && haptic.includes('hapticToken'), 'global watch app must deduplicate haptics by semantic token')
assert.ok(app.includes('markApplied'), 'global watch app must support applied acknowledgements')
assert.ok(app.includes('scheduleDeviceTransportReconnect'), 'watch MessageBuilder failures must self-recover without reopening the app')
assert.ok(home.includes('requestLatestNav'), 'home must request one reconciliation snapshot after it is rebuilt')
assert.ok(screenSettings.includes('relaunch: true') && !screenSettings.includes('relaunch: false'), 'Balance must relaunch RingMap after the system destroys it on screen-off')

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
  assert.ok(value.module.page.pages.includes('page/theme'), `${target} must package the theme picker`)
  const width = value.designWidth
  const appIcon = pngInfo(`assets/${target}/icon.png`)
  assert.equal(appIcon.width, 248, `${target} app icon width`)
  assert.equal(appIcon.height, 248, `${target} app icon height`)
  assert.equal(appIcon.colorType, 6, `${target} app icon must be transparent outside its circle`)
  const bg = pngInfo(`assets/${target}/night-corridor-bg.png`)
  assert.equal(bg.width, width, `${target} background width`)
  assert.equal(bg.height, width, `${target} background height`)
  const anime = pngInfo(`assets/${target}/anime-background.png`)
  assert.equal(anime.width, width, `${target} anime background width`)
  assert.equal(anime.height, width, `${target} anime background height`)
  const qr = pngInfo(`assets/${target}/github-qr.png`)
  assert.ok(qr.width === (width === 466 ? 172 : 176), `${target} QR width`)
  for (const name of ['switch-on.png', 'switch-off.png', 'switch-thumb.png']) {
    const switchImage = pngInfo(`assets/${target}/${name}`)
    assert.equal(switchImage.colorType, 6, `${target}/${name} must retain transparency`)
  }
  for (const action of actions) {
    const info = pngInfo(`assets/${target}/nav-${action.replaceAll('_','-')}.png`)
    assert.equal(info.width, 152, `${target}/${action} width`)
    assert.equal(info.height, 152, `${target}/${action} height`)
    assert.equal(info.colorType, 6, `${target}/${action} must retain RGBA`)
  }
}
console.log('watch 3.0 product UI tests passed')
