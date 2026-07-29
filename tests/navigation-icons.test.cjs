const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('page/navigation.js', 'utf8')
const icons = fs.readFileSync('utils/icons.js', 'utf8')
const names = ['nav-straight.png','nav-turn-left.png','nav-turn-right.png','nav-uturn-left.png','nav-arrive.png','nav-wait.png']

function pngInfo(file) {
  const data = fs.readFileSync(file)
  assert(data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `not a PNG: ${file}`)
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data.readUInt8(25) }
}

const legacyPauseHash = '720aa25867da190d1a112c291b822ed1c526126cf5127f7158df81978d2c0e85'
for (const name of names) {
  const file = 'assets/common/' + name
  assert(fs.existsSync(file), `missing icon asset: ${name}`)
  const info = pngInfo(file)
  assert(info.width === 152 && info.height === 152, `icon must match its larger 152px widget: ${name}`)
  assert(info.colorType === 6, `icon must retain an RGBA transparent background: ${name}`)
}
assert(icons.includes('widget.IMG'), 'icons must use IMG widgets')
assert(icons.includes('src: ICONS[type] || ICONS.wait'), 'icons must use the complete action map')
assert(source.includes('createActionIcon'), 'navigation page must import image icons')
assert(!source.includes('line({'), 'navigation page must not draw arrow geometry')
assert(source.includes('this.renderNav(null, appData.navState)'), 'waiting state must clear directional data')
assert(!source.includes('按键返回'), 'navigation page must not mention an unavailable hardware return action')
assert.notEqual(require('crypto').createHash('sha256').update(fs.readFileSync('assets/common/nav-wait.png')).digest('hex'), legacyPauseHash, 'watch waiting state must not use a pause symbol')
assert.notEqual(require('crypto').createHash('sha256').update(fs.readFileSync('android/app/src/main/res/drawable-nodpi/nav_wait.png')).digest('hex'), legacyPauseHash, 'Android waiting state must not use a pause symbol')
assert(!source.includes("from '@zos/router'"), 'navigation page must not require router-back interaction')
for (const target of ['balance', 'gtr4', 'cheetahpro', 'active2', 'trex3', 'trex3-pro']) {
  for (const name of names) {
    const info = pngInfo(`assets/${target}/${name}`)
    assert(info.width === 152 && info.height === 152 && info.colorType === 6, `packaged ${target} icon wrong: ${name}`)
  }
}
console.log('navigation icon assets tests passed')
