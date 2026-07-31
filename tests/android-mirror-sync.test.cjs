const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const canonical = path.resolve('..', 'RingMap-android')
const mirror = path.resolve('android')
if (!fs.existsSync(canonical)) {
  console.log('Android mirror source check skipped: canonical project is unavailable')
  process.exit(0)
}
const excluded = new Set(['.gradle', 'build', 'local.properties'])
const excludedExtensions = new Set(['.apk', '.aab'])

function listFiles(root, relative = '') {
  const directory = path.join(root, relative)
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  let files = []
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue
    const next = path.join(relative, entry.name)
    if (entry.isDirectory()) files = files.concat(listFiles(root, next))
    else if (entry.isFile() && !excludedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(next)
    }
  }
  return files.sort()
}

const canonicalFiles = listFiles(canonical)
const mirrorFiles = listFiles(mirror)
assert.deepEqual(mirrorFiles, canonicalFiles, 'Android Git mirror must contain the same tracked source files as the canonical Android project')
for (const relative of canonicalFiles) {
  const source = fs.readFileSync(path.join(canonical, relative))
  const copy = fs.readFileSync(path.join(mirror, relative))
  assert.ok(source.equals(copy), `Android mirror differs: ${relative}`)
}

console.log('Android canonical source and repository mirror are identical')
