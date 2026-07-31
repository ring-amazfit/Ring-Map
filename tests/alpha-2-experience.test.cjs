const assert = require('node:assert/strict')
const fs = require('node:fs')

const watchConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const androidRoot = 'android/app'
const androidBuild = fs.readFileSync(`${androidRoot}/build.gradle`, 'utf8')
const manifest = fs.readFileSync(`${androidRoot}/src/main/AndroidManifest.xml`, 'utf8')
const main = fs.readFileSync(`${androidRoot}/src/main/java/com/ringmap/nav/MainActivity.java`, 'utf8')
const settings = fs.readFileSync(`${androidRoot}/src/main/java/com/ringmap/nav/ui/SettingsFragment.java`, 'utf8')
const settingsLayout = fs.readFileSync(`${androidRoot}/src/main/res/layout/fragment_settings.xml`, 'utf8')
const about = fs.readFileSync('page/about.js', 'utf8')
const home = fs.readFileSync('page/home.js', 'utf8')
const app = fs.readFileSync('app.js', 'utf8')

assert.equal(androidBuild.includes('versionCode 13'), true, 'Android Alpha-2 must increment the installable version code')
assert.equal(androidBuild.includes('versionName "Alpha-2"'), true, 'Android test build must expose Alpha-2')
assert.equal(watchConfig.app.version.code, 18, 'watch 1.1.1 must increment the installable version code')
assert.equal(watchConfig.app.version.name, '1.1.1', 'watch test build must expose 1.1.1')

assert(manifest.includes('REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'), 'enhanced connection needs the user-approved battery optimization request permission')
assert(main.includes('requestIgnoreBatteryOptimizations'), 'Android must offer the official battery allowlist request')
assert(main.includes('isIgnoringBatteryOptimizations'), 'Android must show the actual battery allowlist state')
assert(settings.includes('showConnectionProtection'), 'settings must describe the actual connection protection state and actions')
assert(settingsLayout.includes('rowConnectionProtection'), 'settings must expose the enhanced connection entry')
assert(settingsLayout.includes('rowBackgroundAccess'), 'settings must retain the OS-specific background guide entry')

assert(home.includes("page/activation"), 'unactivated watch home must expose the activation route')
assert(app.includes('isWatchActivated'), 'watch must persist first-connection activation state')
assert(app.includes('markWatchActivated'), 'a real phone bridge packet must activate the watch')
assert(about.includes("page/activation") && about.includes('重新查看 Android 下载二维码'),
  'watch About must expose a re-download QR entry')
assert(fs.existsSync('page/activation.js'), 'watch must have a dedicated activation page')
const activation = fs.readFileSync('page/activation.js', 'utf8')
assert(activation.includes("src: 'download-qr.png'"), 'activation page must render the companion download QR')
for (const target of Object.keys(watchConfig.targets)) {
  assert(fs.existsSync(`assets/${target}/download-qr.png`), `${target} must package the download QR`)
}

console.log('Alpha-2 connection and activation experience contracts passed')
