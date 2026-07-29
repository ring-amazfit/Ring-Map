const assert = require('assert')
const fs = require('fs')

for (const file of ['page/home.js', 'page/settings.js', 'page/about.js']) {
  const source = fs.readFileSync(file, 'utf8')
  assert(source.includes("src: 'night-corridor-bg.png'"), `${file} must use the shared corridor background`)
  assert(source.includes('0xF6FAF8'), `${file} must use the primary high contrast text token`)
  assert(!source.includes('0x49A7FF'), `${file} must not retain the old generic blue palette`)
  assert(!source.includes('0xFFB547'), `${file} must not fall back to the old one-note amber palette`)
}
console.log('watch palette consistency tests passed')
