const assert = require('assert')
const fs = require('fs')

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const about = fs.readFileSync('page/about.js', 'utf8')
const releaseScript = fs.readFileSync('scripts/build-watch-release.cjs', 'utf8')

assert.strictEqual(app.app.version.code, 13, 'watch version code must increase for the reliability release')
assert.strictEqual(app.app.version.name, '3.0.1', 'watch version name must identify the reliability release')
assert(about.includes('ZeppOS 3.0.1 · APP ID 1121554'), 'about page must report the installable watch version')
assert(about.includes("src: 'github-qr.png'"), 'about page must include the repository QR')
for (const target of ['balance', 'gtr4', 'gtr4-limited', 'cheetahpro', 'active2', 'active2-nfc', 'trex3', 'trex3-pro']) {
  assert(releaseScript.includes(`'${target}'`), `release script must build ${target}`)
}
assert(releaseScript.includes("run(['prune', '--ip'])"), 'every target release must be pruned after build')
assert(releaseScript.includes('restoreOriginalDist') && releaseScript.includes('finally'), 'release failures must restore the previous dist contents')
assert(releaseScript.includes('writeChecksums') && releaseScript.includes("createHash('sha256')"), 'release success must regenerate SHA256SUMS')
console.log('watch release version tests passed')
