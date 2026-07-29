const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const staging = path.join(root, '.watch-release-staging')
const preserved = path.join(staging, 'preserved')
const packages = path.join(staging, 'packages')
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const version = config.app.version.name
const targets = [
  { key: 'balance', device: 'Amazfit Balance' },
  { key: 'gtr4', device: 'Amazfit GTR 4' },
  { key: 'gtr4-limited', device: 'Amazfit GTR 4 Limited Edition' },
  { key: 'cheetahpro', device: 'Amazfit Cheetah Pro' },
  { key: 'active2', device: 'Amazfit Active 2 (Round)' },
  { key: 'active2-nfc', device: 'Amazfit Active 2 NFC (Round)' },
  { key: 'trex3', device: 'Amazfit T-Rex 3' },
  { key: 'trex3-pro', device: 'Amazfit T-Rex 3 Pro (48mm)' }
]
const zeus = process.platform === 'win32' ? 'zeus.cmd' : 'zeus'
const zeusEntry = process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'npm/node_modules/@zeppos/zeus-cli/bin/main.js')
  : null

function run(args) {
  const command = process.platform === 'win32' ? process.execPath : zeus
  const commandArgs = process.platform === 'win32' ? [zeusEntry, ...args] : args
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: false
  })
  if (result.error) throw result.error
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
  throw new Error('Timed out waiting for a stable pruned ZAB')
}

function clearDist() {
  fs.mkdirSync(dist, { recursive: true })
  for (const file of fs.readdirSync(dist)) {
    fs.rmSync(path.join(dist, file), { recursive: true, force: true })
  }
}

function copyFiles(sourceDirectory, targetDirectory, include) {
  fs.mkdirSync(targetDirectory, { recursive: true })
  for (const file of fs.readdirSync(sourceDirectory)) {
    const source = path.join(sourceDirectory, file)
    if (fs.statSync(source).isFile() && (!include || include(file))) {
      fs.copyFileSync(source, path.join(targetDirectory, file))
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

function buildAllTargets() {
  for (const target of targets) {
    run(['build', '--target', target.device])
    run(['prune', '--ip'])
    sleep(5000)
    const artifact = waitForPrunedArtifact()
    const output = `RingMap-ZeppOS-${version}-${target.key}.zab`
    fs.copyFileSync(path.join(dist, artifact), path.join(packages, output))
    fs.rmSync(path.join(dist, artifact), { force: true })
  }
}

function publishRelease() {
  clearDist()
  copyFiles(packages, dist)
  copyFiles(preserved, dist, file => !file.endsWith('.zab') && file !== 'SHA256SUMS.txt')
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
  buildAllTargets()
  publishRelease()
  writeChecksums()
  console.log(`Built ${targets.length} pruned ZeppOS target packages in ${dist}`)
} catch (error) {
  if (fs.existsSync(preserved)) restoreOriginalDist()
  throw error
} finally {
  fs.rmSync(staging, { recursive: true, force: true })
}
