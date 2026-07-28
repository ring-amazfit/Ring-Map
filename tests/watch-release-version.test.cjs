const assert = require('assert')
const fs = require('fs')

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const about = fs.readFileSync('page/about.js', 'utf8')

assert.strictEqual(app.app.version.code, 8, 'watch version code must increase so Zepp installs the Android recovery release')
assert.strictEqual(app.app.version.name, '2.4.1', 'watch version name must identify the Android recovery release')
assert(about.includes('手表端 2.4.1 · APPID 1121554'), 'about page must report the installable watch version')
console.log('watch release version tests passed')
