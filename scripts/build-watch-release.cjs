const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const zlib = require('node:zlib')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const staging = path.join(root, '.watch-release-staging')
const preserved = path.join(staging, 'preserved')
const packages = path.join(staging, 'packages')
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const version = config.app.version.name
const versionCode = config.app.version.code
const RELEASE_MANIFEST = 'RELEASE_MANIFEST.json'
const releaseManifestPath = path.join(dist, RELEASE_MANIFEST)

function candidateZeusEntries() {
  return [
    path.join(root, 'node_modules', '@zeppos', 'zeus-cli', 'bin', 'main.js'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@zeppos', 'zeus-cli', 'bin', 'main.js')
  ]
}

const zeusSource = candidateZeusEntries().find(file => fs.existsSync(file))
if (!zeusSource) {
  throw new Error('Zeus CLI is unavailable. Run npm install before building a watch release.')
}

function readDeviceCatalog() {
  const cache = path.join(process.env.USERPROFILE || '', '.zepp', '.zeus_devices')
  if (!fs.existsSync(cache)) {
    throw new Error(`Zeus device catalog is unavailable: ${cache}`)
  }
  const raw = JSON.parse(fs.readFileSync(cache, 'utf8'))
  return Array.isArray(raw.devices) ? raw.devices : []
}

function targetsFromConfig() {
  const catalog = readDeviceCatalog()
  const sourceToDevice = new Map()
  for (const device of catalog) {
    if (!device || !device.deviceSource || !device.productName) continue
    sourceToDevice.set(Number(device.deviceSource), String(device.productName))
  }

  const grouped = new Map()
  for (const [key, target] of Object.entries(config.targets || {})) {
    const expectedSources = (target.platforms || []).map(platform => Number(platform.deviceSource))
    if (!expectedSources.length) throw new Error(`Target ${key} has no deviceSource declarations`)
    const byDevice = new Map()
    for (const source of expectedSources) {
      const device = sourceToDevice.get(source)
      if (!device) throw new Error(`No Zeus device catalog entry for ${key} deviceSource ${source}`)
      if (!byDevice.has(device)) byDevice.set(device, [])
      byDevice.get(device).push(source)
    }
    for (const [device, sources] of byDevice) {
      const id = `${key}:${device}`
      grouped.set(id, { key: key, device: device, expectedSources: sources })
    }
  }
  return [...grouped.values()]
}

const targets = targetsFromConfig()

function run(args) {
  const privateModules = path.join(path.dirname(path.dirname(zeusSource)), 'private-modules')
  const env = { ...process.env }
  if (fs.existsSync(path.join(privateModules, 'zeppos-app-utils', 'package.json'))) {
    env.NODE_PATH = [privateModules, env.NODE_PATH || ''].filter(Boolean).join(path.delimiter)
  }
  const result = spawnSync(process.execPath, [zeusSource, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    timeout: 180000,
    env: env
  })
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`Zeus command timed out after three minutes: ${args.join(' ')}`)
    }
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Zeus command failed (${result.status}): ${args.join(' ')}`)
  }
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function waitForPrunedArtifact() {
  const deadline = Date.now() + 60000
  let lastFile = ''
  let lastSize = -1
  let stableChecks = 0
  while (Date.now() < deadline) {
    const artifacts = fs.readdirSync(dist).filter(file => file.endsWith('.zab'))
    if (artifacts.length === 1) {
      const file = artifacts[0]
      const size = fs.statSync(path.join(dist, file)).size
      if (size < 5 * 1024 * 1024 && file === lastFile && size === lastSize) {
        stableChecks += 1
        if (stableChecks >= 3) return file
      } else {
        stableChecks = 0
      }
      lastFile = file
      lastSize = size
    }
    sleep(250)
  }
  throw new Error('Timed out waiting for a single stable pruned ZAB')
}

function clearDist() {
  fs.mkdirSync(dist, { recursive: true })
  for (const file of fs.readdirSync(dist)) {
    fs.rmSync(path.join(dist, file), { recursive: true, force: true })
  }
}

function copyFiles(sourceDirectory, targetDirectory, include) {
  if (!fs.existsSync(sourceDirectory)) return
  fs.mkdirSync(targetDirectory, { recursive: true })
  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const source = path.join(sourceDirectory, entry.name)
    const destination = path.join(targetDirectory, entry.name)
    if (entry.isDirectory()) {
      fs.cpSync(source, destination, { recursive: true })
    } else if (entry.isFile() && (!include || include(entry.name))) {
      fs.copyFileSync(source, destination)
    }
  }
}

function restoreOriginalDist() {
  clearDist()
  copyFiles(preserved, dist)
}

function prepareRelease() {
  fs.mkdirSync(dist, { recursive: true })
  fs.rmSync(staging, { recursive: true, force: true })
  fs.mkdirSync(preserved, { recursive: true })
  fs.mkdirSync(packages, { recursive: true })
  copyFiles(dist, preserved)
  clearDist()
}

function zipEntry(buffer, offset) {
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZAB local ZIP header')
  const method = buffer.readUInt16LE(offset + 8)
  const compressedSize = buffer.readUInt32LE(offset + 18)
  const uncompressedSize = buffer.readUInt32LE(offset + 22)
  const nameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const nameStart = offset + 30
  const name = buffer.subarray(nameStart, nameStart + nameLength).toString('utf8')
  const contentStart = nameStart + nameLength + extraLength
  const content = buffer.subarray(contentStart, contentStart + compressedSize)
  let data
  if (method === 0) data = content
  else if (method === 8) data = zlib.inflateRawSync(content)
  else throw new Error(`Unsupported ZAB ZIP compression method ${method}`)
  if (data.length !== uncompressedSize) throw new Error(`Invalid ZAB ZIP size for ${name}`)
  return { name, data, nextOffset: contentStart + compressedSize }
}

function readZabManifest(file) {
  const archive = fs.readFileSync(file)
  let offset = 0
  while (offset + 4 <= archive.length) {
    const signature = archive.readUInt32LE(offset)
    if (signature !== 0x04034b50) break
    const entry = zipEntry(archive, offset)
    if (entry.name === 'manifest.json') return JSON.parse(entry.data.toString('utf8'))
    offset = entry.nextOffset
  }
  throw new Error(`manifest.json not found in ${path.basename(file)}`)
}

function validateArtifactManifest(file, target) {
  const manifest = readZabManifest(file)
  const zpks = Array.isArray(manifest.zpks) ? manifest.zpks : []
  const actualSources = [...new Set(zpks.flatMap(zpk => (zpk.platforms || [])
    .map(platform => Number(platform.deviceSource))))].sort((a, b) => a - b)
  const expectedSources = [...new Set(target.expectedSources)].sort((a, b) => a - b)
  if (zpks.length !== 1) throw new Error(`${target.device}: expected one ZPK, found ${zpks.length}`)
  if (zpks[0].version.code !== versionCode || zpks[0].version.name !== version) {
    throw new Error(`${target.device}: manifest version ${zpks[0].version.name}/${zpks[0].version.code} does not match ${version}/${versionCode}`)
  }
  if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) {
    throw new Error(`${target.device}: manifest deviceSource mismatch; expected ${expectedSources.join(',')}, got ${actualSources.join(',')}`)
  }
  return { version: zpks[0].version, deviceSources: actualSources }
}

function buildAllTargets() {
  const records = []
  for (const target of targets) {
    console.log(`\n=== Building ${target.key} for ${target.device} ===`)
    run(['build', '--target', target.device])
    run(['prune', '--ip'])
    const artifact = waitForPrunedArtifact()
    const output = `RingMap-ZeppOS-${version}-${target.key}-${target.expectedSources.join('-')}.zab`
    const source = path.join(dist, artifact)
    const destination = path.join(packages, output)
    fs.copyFileSync(source, destination)
    fs.rmSync(source, { force: true })
    const validated = validateArtifactManifest(destination, target)
    records.push({
      file: output,
      target: target.key,
      device: target.device,
      deviceSources: validated.deviceSources,
      version: validated.version,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex')
    })
  }
  return records
}

function publishRelease() {
  clearDist()
  copyFiles(packages, dist)
  copyFiles(preserved, dist, file => !file.endsWith('.zab') && file !== 'SHA256SUMS.txt'
    && file !== RELEASE_MANIFEST)
}

function writeReleaseManifest(records) {
  fs.writeFileSync(releaseManifestPath, `${JSON.stringify({
    appId: config.app.appId,
    version: { name: version, code: versionCode },
    zeusCli: path.relative(root, zeusSource).replaceAll(path.sep, '/'),
    packages: records
  }, null, 2)}\n`)
}

function writeChecksums() {
  const files = fs.readdirSync(dist)
    .filter(file => file !== 'SHA256SUMS.txt' && fs.statSync(path.join(dist, file)).isFile())
    .sort()
  const lines = files.map(file => {
    const digest = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(dist, file)))
      .digest('hex')
    return `${digest} *${file}`
  })
  fs.writeFileSync(path.join(dist, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`)
}

try {
  prepareRelease()
  const records = buildAllTargets()
  publishRelease()
  writeReleaseManifest(records)
  writeChecksums()
  console.log(`Built ${records.length} validated ZeppOS target packages in ${dist}`)
} catch (error) {
  if (fs.existsSync(preserved)) restoreOriginalDist()
  throw error
} finally {
  fs.rmSync(staging, { recursive: true, force: true })
}
