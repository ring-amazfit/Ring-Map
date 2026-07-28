const assert = require('assert')
const fs = require('fs')

const nav = fs.readFileSync('page/navigation.js', 'utf8')
const home = fs.readFileSync('page/home.js', 'utf8')
const androidApp = fs.readFileSync('android/app/src/main/java/com/ringmap/nav/RingMapApp.java', 'utf8')

assert(nav.includes('var TURN = 0xFFB547'), 'watch navigation should use amber highlight')
assert(nav.includes('var BG = 0x050505'), 'watch navigation should use black background')
assert(home.includes('var BG = 0x050505'), 'watch home should use black background')
assert(androidApp.includes('DynamicColors.applyToActivitiesIfAvailable'), 'Android app must retain Monet dynamic colors')
assert(!androidApp.includes('setTheme') || androidApp.includes('DynamicColors'), 'Android theme must not be replaced by a fixed green theme')
console.log('palette tests passed')
