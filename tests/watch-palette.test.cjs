const assert = require('assert')
const fs = require('fs')

const theme = fs.readFileSync('utils/theme.js', 'utf8')
assert(theme.includes("src: 'night-corridor-bg.png'"), 'the corridor theme must remain available')
assert(theme.includes("src: 'anime-background.png'"), 'the anime theme must remain available')
for (const file of ['page/home.js', 'page/settings.js', 'page/about.js']) {
  const source = fs.readFileSync(file, 'utf8')
  assert(source.includes('drawThemeBackground'), `${file} must use the shared theme background`)
  assert(source.includes('0xF6FAF8'), `${file} must use the primary high contrast text token`)
  assert(!source.includes('0x49A7FF'), `${file} must not retain the old generic blue palette`)
  assert(!source.includes('0xFFB547'), `${file} must not fall back to the old one-note amber palette`)
}
console.log('watch palette consistency tests passed')
