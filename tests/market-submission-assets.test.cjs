const assert = require('node:assert/strict')
const fs = require('node:fs')

function pngInfo(file) {
  const data = fs.readFileSync(file)
  assert.ok(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `not a PNG: ${file}`)
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data.readUInt8(25)
  }
}

const market = 'docs/market-assets'
const icon = pngInfo(`${market}/store-icon-240.png`)
assert.deepEqual(icon, { width: 240, height: 240, colorType: 6 },
  'Zepp market icon must be a 240x240 transparent PNG')

const screenshots = [
  'screen-navigation-turn-360.png',
  'screen-navigation-waiting-360.png',
  'screen-navigation-theme-360.png',
  'screen-settings-360.png',
  'screen-about-360.png'
]
for (const screenshot of screenshots) {
  const info = pngInfo(`${market}/${screenshot}`)
  assert.deepEqual(info, { width: 360, height: 360, colorType: 6 },
    `Zepp market screenshot must be a 360x360 transparent PNG: ${screenshot}`)
}

const kit = fs.readFileSync('docs/MARKET_SUBMISSION.md', 'utf8')
const privacy = fs.readFileSync('PRIVACY.md', 'utf8')
const readmeEn = fs.readFileSync('README_EN.md', 'utf8')
assert(kit.includes('Version code | `18`'), 'market kit must identify the watch version code')
assert(kit.includes('store-icon-240.png') || fs.existsSync(`${market}/store-icon-240.png`),
  'market kit must ship a console-ready icon')
assert(kit.includes('Privacy Statement'), 'market kit must contain the privacy copy')
assert(privacy.includes('127.0.0.1:8886'), 'privacy statement must accurately disclose the local bridge')
assert(readmeEn.includes('Alpha-2') && readmeEn.includes('1.1.1'),
  'English README must use current release labels')

console.log('ZeppOS market submission asset contracts passed')
