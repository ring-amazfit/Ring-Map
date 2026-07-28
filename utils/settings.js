import { localStorage } from '@zos/storage'
import { setPageBrightTime, setWakeUpRelaunch } from '@zos/display'

var KEY_KEEP_SCREEN = 'rm_keep_screen'
var KEY_AUTO_OPEN = 'rm_auto_open'
var KEY_VIBRATE = 'rm_vibrate'
var KEY_BIG_TEXT = 'rm_big_text'
var KEY_SHOW_SOURCE = 'rm_show_source'
var KEY_STAY_HOME = 'rm_stay_home'
var BRIGHT_ON = 2147483000
var BRIGHT_OFF = 30000

export function isKeepScreenEnabled() {
  return localStorage.getItem(KEY_KEEP_SCREEN) === '1'
}

export function setKeepScreenEnabled(enabled) {
  localStorage.setItem(KEY_KEEP_SCREEN, enabled ? '1' : '0')
  applyKeepScreen(enabled)
}

export function applyKeepScreen(enabled) {
  try {
    setPageBrightTime({ brightTime: enabled ? BRIGHT_ON : BRIGHT_OFF })
  } catch (e) {
    console.log('RingMap: set bright time failed', e)
  }
  // 熄屏/唤醒后保持当前应用和当前页面，不因息屏而退出导航。
  try {
    setWakeUpRelaunch({ relaunch: true })
  } catch (e) {
    console.log('RingMap: set wake relaunch failed', e)
  }
}

export function applySavedScreenSetting() {
  applyKeepScreen(isKeepScreenEnabled())
}

export function isAutoOpenEnabled() { return localStorage.getItem(KEY_AUTO_OPEN) !== '0' }
export function setAutoOpenEnabled(enabled) { localStorage.setItem(KEY_AUTO_OPEN, enabled ? '1' : '0') }
export function isVibrateEnabled() { return localStorage.getItem(KEY_VIBRATE) !== '0' }
export function setVibrateEnabled(enabled) { localStorage.setItem(KEY_VIBRATE, enabled ? '1' : '0') }
export function isBigTextEnabled() { return localStorage.getItem(KEY_BIG_TEXT) === '1' }
export function setBigTextEnabled(enabled) { localStorage.setItem(KEY_BIG_TEXT, enabled ? '1' : '0') }
export function isShowSourceEnabled() { return localStorage.getItem(KEY_SHOW_SOURCE) !== '0' }
export function setShowSourceEnabled(enabled) { localStorage.setItem(KEY_SHOW_SOURCE, enabled ? '1' : '0') }
export function isStayHomeEnabled() { return localStorage.getItem(KEY_STAY_HOME) !== '0' }
export function setStayHomeEnabled(enabled) { localStorage.setItem(KEY_STAY_HOME, enabled ? '1' : '0') }

export function clearNavigationCache() {
  localStorage.removeItem('rm_nav')
  localStorage.removeItem('rm_nav_ts')
  localStorage.setItem('rm_status', 'idle')
}
