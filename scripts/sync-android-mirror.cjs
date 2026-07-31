const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const canonical = path.resolve(root, '..', 'RingMap-android')
const mirror = path.join(root, 'android')
const ignoredNames = new Set(['.gradle', 'build', 'local.properties'])
const ignoredExtensions = new Set(['.apk', '.aab', '.keystore', '.jks'])
const copied = new Set()

if (!fs.existsSync(canonical)) {
  throw new Error(`Canonical Android source is unavailable: ${canonical}`)
}

function ignored(relative, entry) {
  const segments = relative.split(path.sep)
  if (segments.some(segment => ignoredNames.has(segment))) return true
  return entry.isFile() && ignoredExtensions.has(path.extname(entry.name).toLowerCase())
}

function copyTree(relative = '') {
  const sourceDir = path.join(canonical, relative)
  const destinationDir = path.join(mirror, relative)
  fs.mkdirSync(destinationDir, { recursive: true })
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const next = path.join(relative, entry.name)
    if (ignored(next, entry)) continue
    const source = path.join(canonical, next)
    const destination = path.join(mirror, next)
    if (entry.isDirectory()) {
      copyTree(next)
    } else if (entry.isFile()) {
      fs.copyFileSync(source, destination)
      copied.add(next)
    }
  }
}

function pruneMirror(relative = '') {
  const directory = path.join(mirror, relative)
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const next = path.join(relative, entry.name)
    if (ignored(next, entry)) continue
    const target = path.join(mirror, next)
    if (entry.isDirectory()) {
      pruneMirror(next)
      if (fs.readdirSync(target).length === 0) fs.rmdirSync(target)
    } else if (entry.isFile() && !copied.has(next)) {
      fs.rmSync(target, { force: true })
    }
  }
}

copyTree()
pruneMirror()
console.log(`Synchronized ${copied.size} Android source files into ${mirror}`)
