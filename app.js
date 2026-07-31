import { MessageBuilder } from './shared/message'
import { createNavState, reduceNavPacket, expireNavState } from './shared/nav-state'
import { createHapticState, evaluateHaptic } from './shared/haptic-policy'
import { getPackageInfo } from '@zos/app'
import { localStorage } from '@zos/storage'
import { push } from '@zos/router'
import { vibrate } from '@zos/interaction'
import { getHapticMode, isWatchActivated, markWatchActivated } from './utils/settings'
import * as ble from '@zos/ble'

var APP_ID = 1121554
var KEY_NAV = 'rm_nav'
var KEY_STATUS = 'rm_status'
var KEY_TS = 'rm_nav_ts'
var KEY_RECEIVED = 'rm_nav_received'
var builder = null
var expiryTimer = null
var routeTimer = null
var routePushTimer = null
var transportReconnectTimer = null
var transportReconnectAttempt = 0
var transportHandshakeTimer = null
var transportReady = false
var pendingResyncRequest = false

var appData = {
  messageBuilder: null,
  navPageActive: false,
  navPageRefresh: null,
  homePageRefresh: null,
  navRoutePending: false,
  resumeNavigationOnHome: false,
  navSession: '',
  lastAppliedKey: '',
  navState: createNavState(),
  hapticState: createHapticState(),
  watchActivated: false,
  activationPageRefresh: null,
  recoveryId: '',
  watchReadyAt: 0,
  requestLatestNav: requestLatestNav,
  openNavigationPage: openNavigationPage,
  confirmNavigationPage: confirmNavigationPage,
  markApplied: markApplied
}

function clearDeviceTransportReconnect() {
  if (transportReconnectTimer !== null) {
    clearTimeout(transportReconnectTimer)
    transportReconnectTimer = null
  }
}

function clearDeviceTransportHandshake() {
  if (transportHandshakeTimer !== null) {
    clearTimeout(transportHandshakeTimer)
    transportHandshakeTimer = null
  }
}

function scheduleDeviceHandshakeRetry(expectedBuilder) {
  clearDeviceTransportHandshake()
  var delay = Math.min(8000, 1200 * Math.pow(2, transportReconnectAttempt++))
  transportHandshakeTimer = setTimeout(function() {
    transportHandshakeTimer = null
    if (builder !== expectedBuilder || transportReady) return
    console.log('RingMap: BLE handshake timed out, retrying')
    createDeviceTransport()
  }, delay)
}

function scheduleDeviceTransportReconnect() {
  if (transportReconnectTimer !== null) return
  var delay = Math.min(8000, 500 * Math.pow(2, transportReconnectAttempt++))
  transportReconnectTimer = setTimeout(function() {
    transportReconnectTimer = null
    createDeviceTransport()
  }, delay)
}

function createRecoveryId() {
  return 'wake-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
}

function createDeviceTransport() {
  clearDeviceTransportReconnect()
  clearDeviceTransportHandshake()
  transportReady = false
  var previous = builder
  if (previous) {
    try { previous.disConnect() } catch (e) {}
  }
  try {
    var next = new MessageBuilder({
      appId: APP_ID,
      appDevicePort: 20,
      appSidePort: 0,
      ble: ble
    })
    next.on('call', function(context) {
      if (builder !== next) return
      try {
        handleWatchPacket(next.buf2Json(context.payload))
      } catch (e) {
        console.log('RingMap: global message error', e)
      }
    })
    next.on('connected', function() {
      if (builder !== next || transportReady) return
      transportReady = true
      transportReconnectAttempt = 0
      clearDeviceTransportHandshake()
      sendWatchReady()
      requestLatestNav()
    })
    builder = next
    appData.messageBuilder = next
    next.connect()
    scheduleDeviceHandshakeRetry(next)
  } catch (e) {
    console.log('RingMap: device transport create failed', e)
    builder = null
    appData.messageBuilder = null
    scheduleDeviceTransportReconnect()
  }
}

function sendPacket(packet) {
  if (!builder || !packet || !transportReady) return false
  try {
    var result = builder.call(packet)
    if (result && typeof result.catch === 'function') {
      result.catch(function(error) {
        console.log('RingMap: device packet failed', error)
        scheduleDeviceTransportReconnect()
      })
    }
    return true
  } catch (e) {
    console.log('RingMap: device packet failed', e)
    scheduleDeviceTransportReconnect()
    return false
  }
}

function sendWatchReady() {
  var now = Date.now()
  appData.watchReadyAt = now
  sendPacket({
    protocolVersion: 2,
    type: 'watch_ready',
    recoveryId: appData.recoveryId,
    watchReadyAt: now,
    sessionId: appData.navState.sessionId,
    seq: appData.navState.seq,
    emittedAt: now
  })
}

function sendWatchSleep() {
  if (!builder || !transportReady) return false
  var packet = {
    protocolVersion: 2,
    type: 'watch_sleep',
    recoveryId: appData.recoveryId,
    watchReadyAt: appData.watchReadyAt,
    sessionId: appData.navState.sessionId,
    seq: appData.navState.seq,
    emittedAt: Date.now()
  }
  try {
    builder.notify(packet)
    return true
  } catch (e) {
    console.log('RingMap: watch sleep notify failed', e)
    return false
  }
}

function requestLatestNav() {
  if (!transportReady) {
    pendingResyncRequest = true
    return
  }
  pendingResyncRequest = false
  sendPacket({
    protocolVersion: 2,
    type: 'resync',
    recoveryId: appData.recoveryId,
    watchReadyAt: appData.watchReadyAt,
    sessionId: appData.navState.sessionId,
    seq: appData.navState.seq,
    emittedAt: Date.now()
  })
}

function notifyActivation() {
  if (typeof appData.activationPageRefresh === 'function') {
    appData.activationPageRefresh(appData.watchActivated)
  }
  if (typeof appData.homePageRefresh === 'function') {
    appData.homePageRefresh(appData.navState.snapshot, appData.navState)
  }
}

function activateWatch() {
  if (appData.watchActivated) return
  markWatchActivated()
  appData.watchActivated = true
  notifyActivation()
}

function sendAck(snapshot, status, widgetAppliedAt) {
  if (!snapshot) return
  sendPacket({
    protocolVersion: 2,
    type: 'nav_ack',
    status: status,
    sessionId: snapshot.sessionId,
    sessionStartedAt: snapshot.sessionStartedAt,
    seq: snapshot.seq,
    recoveryId: snapshot.recoveryId || appData.recoveryId,
    watchReadyAt: snapshot.watchReadyAt || appData.watchReadyAt || 0,
    androidResyncReceivedAt: snapshot.androidResyncReceivedAt || 0,
    androidResyncSentAt: snapshot.androidResyncSentAt || 0,
    appSideReceivedAt: snapshot.appSideReceivedAt || 0,
    appSideWatchSentAt: snapshot.appSideWatchSentAt || 0,
    bridgeReceivedAt: snapshot.bridgeReceivedAt || 0,
    bridgeSentAt: snapshot.bridgeSentAt || 0,
    watchReceivedAt: appData.navState.receivedAt || Date.now(),
    widgetAppliedAt: widgetAppliedAt || 0,
    emittedAt: Date.now()
  })
}

function markApplied(snapshot) {
  var current = appData.navState.snapshot
  if (!snapshot || !current) return
  if (snapshot.sessionId !== current.sessionId || Number(snapshot.seq) !== Number(current.seq)) return
  var appliedKey = String(current.sessionId || '') + ':' + String(current.seq || '')
  if (appData.lastAppliedKey === appliedKey) return
  sendAck(current, 'applied', Date.now())
  appData.lastAppliedKey = appliedKey
}

function autoOpenEnabled() {
  return localStorage.getItem('rm_auto_open') !== '0'
}

function confirmNavigationPage() {
  appData.navRoutePending = false
  appData.resumeNavigationOnHome = false
  if (routeTimer !== null) {
    clearTimeout(routeTimer)
    routeTimer = null
  }
  if (routePushTimer !== null) {
    clearTimeout(routePushTimer)
    routePushTimer = null
  }
}

function openNavigationPage() {
  if (!appData.watchActivated || !autoOpenEnabled()
      || appData.navPageActive || appData.navRoutePending) return
  appData.navRoutePending = true
  if (routeTimer !== null) clearTimeout(routeTimer)
  routeTimer = setTimeout(function() {
    routeTimer = null
    appData.navRoutePending = false
  }, 1500)
  var scheduledSession = appData.navState.sessionId
  routePushTimer = setTimeout(function() {
    routePushTimer = null
    if (appData.navState.status !== 'active'
        || appData.navState.sessionId !== scheduledSession) {
      confirmNavigationPage()
      return
    }
    try {
      push({ url: 'page/navigation', anim: true })
    } catch (e) {
      confirmNavigationPage()
      console.log('RingMap: navigation page open failed', e)
    }
  }, 0)
}

function clearStoredNavigation(status) {
  localStorage.removeItem(KEY_NAV)
  localStorage.removeItem(KEY_TS)
  localStorage.removeItem(KEY_RECEIVED)
  localStorage.setItem(KEY_STATUS, status || 'idle')
}

function storeSnapshot(snapshot, receivedAt) {
  localStorage.setItem(KEY_NAV, JSON.stringify(snapshot))
  localStorage.setItem(KEY_TS, String(snapshot.emittedAt || Date.now()))
  localStorage.setItem(KEY_RECEIVED, String(receivedAt || Date.now()))
  localStorage.setItem(KEY_STATUS, 'navigating')
}

function maybeVibrate(snapshot, previous) {
  var decision = evaluateHaptic(appData.hapticState, getHapticMode(),
    snapshot, previous, Date.now())
  appData.hapticState = decision.state
  if (!decision.vibrate) return
  try { vibrate({ duration: decision.duration }) } catch (e) {}
}

function notifyPages(snapshot) {
  if (typeof appData.homePageRefresh === 'function') {
    appData.homePageRefresh(snapshot, appData.navState)
  }
  if (appData.navPageActive && typeof appData.navPageRefresh === 'function') {
    appData.navPageRefresh(snapshot, appData.navState)
  }
}

function cancelExpiry() {
  if (expiryTimer !== null) {
    clearTimeout(expiryTimer)
    expiryTimer = null
  }
}

function scheduleExpiry() {
  cancelExpiry()
  if (appData.navState.status !== 'active' || !appData.navState.expiresAt) return
  var delay = Math.max(1, appData.navState.expiresAt - Date.now() + 20)
  expiryTimer = setTimeout(function() {
    expiryTimer = null
    var expired = expireNavState(appData.navState, Date.now())
    if (!expired.changed) {
      scheduleExpiry()
      return
    }
    appData.navState = expired.state
    appData.navSession = expired.state.sessionId
    appData.lastAppliedKey = ''
    clearStoredNavigation('stale')
    notifyPages(null)
  }, delay)
}

function applyPacket(packet) {
  if (packet.type === 'bridge_state' && packet.status === 'connected'
      && packet.bridgeOrigin === 'android') activateWatch()
  var previousStatus = appData.navState.status
  var previousSnapshot = appData.navState.snapshot
  var reduced = reduceNavPacket(appData.navState, packet, Date.now())
  if (!reduced.changed) return

  appData.navState = reduced.state
  appData.navSession = reduced.state.sessionId

  if (packet.type === 'bridge_state') {
    localStorage.setItem(KEY_STATUS, packet.status === 'connected'
      ? (appData.navState.status === 'active' ? 'navigating' : 'connected')
      : packet.status)
    notifyPages(appData.navState.snapshot)
    if (packet.status === 'connected') requestLatestNav()
    return
  }

  if (packet.type === 'nav_snapshot') {
    storeSnapshot(packet, reduced.state.receivedAt)
    scheduleExpiry()
    maybeVibrate(packet, previousSnapshot)
    notifyPages(packet)
    sendAck(packet, 'accepted', 0)
    if (previousStatus !== 'active' && previousStatus !== 'stale') openNavigationPage()
    return
  }

  if (packet.type === 'nav_end' || packet.type === 'idle') {
    cancelExpiry()
    appData.lastAppliedKey = ''
    confirmNavigationPage()
    clearStoredNavigation('idle')
    notifyPages(null)
  }
}

function restoreCachedNavigation() {
  try {
    var raw = localStorage.getItem(KEY_NAV)
    var receivedAt = Number(localStorage.getItem(KEY_RECEIVED) || 0)
    if (!raw || !receivedAt) return
    var packet = JSON.parse(raw)
    var restored = reduceNavPacket(createNavState(), packet, receivedAt)
    if (!restored.changed) return
    var expired = expireNavState(restored.state, Date.now())
    appData.navState = expired.state
    appData.navSession = expired.state.sessionId
    if (expired.changed) {
      appData.resumeNavigationOnHome = false
      clearStoredNavigation('stale')
    } else {
      appData.resumeNavigationOnHome = true
      scheduleExpiry()
    }
  } catch (e) {
    clearStoredNavigation('idle')
  }
}

function handleWatchPacket(packet) {
  if (!packet) return
  applyPacket(packet)
}

App({
  globalData: appData,

  onCreate() {
    appData.recoveryId = createRecoveryId()
    appData.watchReadyAt = 0
    appData.watchActivated = isWatchActivated()
    getPackageInfo()
    restoreCachedNavigation()
    createDeviceTransport()
  },

  onDestroy() {
    sendWatchSleep()
    cancelExpiry()
    confirmNavigationPage()
    clearDeviceTransportReconnect()
    clearDeviceTransportHandshake()
    if (builder) builder.disConnect()
    builder = null
    appData.messageBuilder = null
    appData.navPageActive = false
    appData.navPageRefresh = null
    appData.homePageRefresh = null
    appData.navRoutePending = false
    appData.resumeNavigationOnHome = false
    appData.navSession = ''
    appData.recoveryId = ''
    appData.watchReadyAt = 0
    appData.watchActivated = false
    appData.activationPageRefresh = null
    transportReady = false
    pendingResyncRequest = false
    appData.navState = createNavState()
    appData.hapticState = createHapticState()
    appData.requestLatestNav = requestLatestNav
    appData.openNavigationPage = openNavigationPage
    appData.confirmNavigationPage = confirmNavigationPage
    appData.markApplied = markApplied
  }
})
