const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'node_modules', '@zeppos', 'zeus-cli', 'bin', 'main.js')
const privateModules = path.join(root, 'node_modules', '@zeppos', 'zeus-cli', 'private-modules')

if (!fs.existsSync(entry) || !fs.existsSync(path.join(privateModules, 'zeppos-app-utils', 'package.json'))) {
  throw new Error('Local Zeus CLI is unavailable. Run npm ci before invoking a ZeppOS command.')
}

const env = { ...process.env }
env.NODE_PATH = [privateModules, env.NODE_PATH || ''].filter(Boolean).join(path.delimiter)
const result = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: env,
  shell: false
})
if (result.error) throw result.error
process.exitCode = result.status === null ? 1 : result.status
