const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('page/navigation.js', 'utf8')
const icons = fs.readFileSync('utils/icons.js', 'utf8')
const helper = fs.readFileSync('utils/icons.js', 'utf8')
const names = ['icon-up.png', 'icon-left.png', 'icon-right.png', 'icon-uturn.png', 'icon-arrive.png']

function pngInfo(file) {
  const data = fs.readFileSync(file)
  assert(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `not a PNG: ${file}`)
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data.readUInt8(25) }
}

for (const name of names) {
  const file = 'assets/icons/' + name
  assert(fs.existsSync(file), `missing icon asset: ${name}`)
  assert(fs.statSync(file).size > 1000, `icon asset is empty: ${name}`)
  const info = pngInfo(file)
  assert(info.width === 180 && info.height === 180, `icon must match its 180px widget: ${name}`)
  assert(info.colorType === 6, `icon must retain an RGBA transparent background: ${name}`)
}
assert(icons.includes('widget.IMG'), 'icons must use IMG widgets')
assert(icons.includes('src: ICONS[type]'), 'icons must use an action map')
assert(source.includes("import { createActionIcon"), 'navigation page must import image icons')
assert(!source.includes('line({'), 'navigation page must not draw arrow geometry')
assert(source.includes('renderNav(null, status)'), 'waiting state must clear the icon without a fake direction')
assert(source.includes("actionIcon('waiting')") || helper.includes("type === 'waiting'"), 'waiting state must map to no icon')
assert(helper.includes('return null'), 'waiting action must not create an image widget')
assert(!source.includes('按键返回'), 'navigation page must not mention an unavailable hardware return action')
assert(!source.includes("from '@zos/router'"), 'navigation page must not require a router-back interaction')
assert(fs.readFileSync('assets/icons/icon-up.png').readUInt8(25) === 6, 'icon assets should use RGBA PNGs with transparency')
for (const target of ['balance', 'gtr4', 'cheetahpro', 'active2', 'trex3', 'trex3-pro']) {
  for (const name of names) {
    const file = 'assets/' + target + '/' + name
    assert(fs.existsSync(file), `missing packaged ${target} icon: ${name}`)
    const info = pngInfo(file)
    assert(info.width === 180 && info.height === 180 && info.colorType === 6, `packaged ${target} icon has the wrong image format: ${name}`)
  }
}
console.log('navigation icon assets tests passed')
