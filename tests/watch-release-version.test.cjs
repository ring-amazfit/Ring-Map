const assert = require('assert')
const fs = require('fs')

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const about = fs.readFileSync('page/about.js', 'utf8')
const releaseScript = fs.readFileSync('scripts/build-watch-release.cjs', 'utf8')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const targetKeys = Object.keys(app.targets)

assert.strictEqual(app.app.version.code, 18, 'watch version code must increase for the 1.1.1 test build')
assert.strictEqual(app.app.version.name, '1.1.1', 'watch version name must identify the current test build')
assert(about.includes('ZeppOS 1.1.1 · APP ID 1121554'), 'about page must report the installable watch version')
assert(about.includes("src: 'github-qr.png'"), 'about page must include the repository QR')
for (const target of targetKeys) {
  assert(app.targets[target].platforms.length > 0, `declared ${target} target must define deviceSource coverage`)
}
assert(releaseScript.includes('Object.entries(config.targets') && releaseScript.includes('targetsFromConfig'),
  'release targets must be derived from the actual app.json deviceSource declarations')
assert(releaseScript.includes('validateArtifactManifest'), 'each generated ZAB must have its manifest version and device coverage verified')
assert(releaseScript.includes('zeusSource') && releaseScript.includes('NODE_PATH'),
  'release builds must resolve the complete project-local Zeus CLI module path before using a global installation')
assert(releaseScript.includes("run(['prune', '--ip'])"), 'every target release must be pruned after build')
assert(releaseScript.includes('restoreOriginalDist') && releaseScript.includes('finally'), 'release failures must restore the previous dist contents')
assert(releaseScript.includes('fs.cpSync') && releaseScript.includes('recursive: true'),
  'release rollback must preserve nested dist artifacts as well as top-level packages')
assert(releaseScript.includes('writeChecksums') && releaseScript.includes("createHash('sha256')"), 'release success must regenerate SHA256SUMS')
assert(releaseScript.includes('RELEASE_MANIFEST.json'), 'release success must publish a machine-readable package manifest')
for (const script of ['build', 'dev', 'preview']) {
  assert(packageJson.scripts[script].startsWith('node scripts/zeus.cjs'),
    `${script} must use the reproducible local Zeus wrapper instead of an implicit global command`)
}
assert(fs.existsSync('scripts/zeus.cjs'), 'the local Zeus wrapper must be versioned with the project')
console.log('watch release version tests passed')
