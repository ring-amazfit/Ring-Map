const assert = require('assert')
const fs = require('fs')

const files = ['page/home.js', 'page/settings.js', 'page/about.js'].map(f => fs.readFileSync(f, 'utf8'))
for (const source of files) {
  assert(source.includes('0x050505'), 'watch secondary page should use black background')
  assert(source.includes('0xFFB547'), 'watch secondary page should use amber accent')
  assert(!source.includes('0x49A7FF'), 'old blue accent must be removed from watch UI')
}
console.log('watch palette consistency tests passed')
