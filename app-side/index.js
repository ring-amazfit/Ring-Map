/**
 * RingMap App-Side - 每个 Zepp companion 上下文的 WebSocket 与 MessageBuilder 中继。
 * Android 是导航会话权威；本层只缓存和转发最新协议快照。
 */

import { MessageBuilder } from '../shared/message-side'

var WS_URL = 'ws://127.0.0.1:8886'
var RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]
var HEARTBEAT_INTERVAL_MS = 10000
var PONG_TIMEOUT_MS = 15000
var WAKE_RESYNC_TIMEOUT_MS = 1500
var WATCH_SNAPSHOT_COALESCE_MS = 80
var MIN_CACHE_REPLAY_MS = 5000
var NAV_CACHE_KEY = '_rm_nav_packet'
var NAV_CACHE_AT_KEY = '_rm_nav_packet_at'
var messageBuilder = new MessageBuilder()
var ws = null
var connectionState = 'disconnected'
var connectionEpoch = 0
var reconnectTimer = null
var heartbeatTimer = null
var reconnectAttempt = 0
var destroyed = false
var lastNavData = null
var lastNavDataAt = 0
var lastPingAt = 0
var lastPongAt = 0
var resyncPending = false
var messageBridgeInitialized = false
var watchActive = false
var watchActivityKnown = false
var activeRecoveryId = ''
var activeWatchReadyAt = 0
var lastStoredStatus = ''
var lastStoredMessage = ''
var messageQueue = Promise.resolve()
var pendingWatchSnapshot = false
var watchSnapshotTimer = null
var wakeResyncTimer = null
var wakeRecovery = null
var authorityResponseRevision = 0

function getSettingsStorage() {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      return settings.settingsStorage
    }
  } catch (e) {}
  return null
}

function setStorageItem(key, value) {
  var ss = getSettingsStorage()
  if (ss) ss.setItem(key, String(value))
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(value))
  } catch (e) {}
}

function removeStorageItem(key) {
  var ss = getSettingsStorage()
  if (ss && ss.removeItem) ss.removeItem(key)
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
  } catch (e) {}
}

function setStatus(status, message) {
  if (status !== lastStoredStatus) {
    setStorageItem('_rm_status', status)
    setStorageItem('rm_status', status)
    lastStoredStatus = status
  }
  if (message !== undefined && message !== lastStoredMessage) {
    setStorageItem('_rm_msg', message)
    setStorageItem('rm_msg', message)
    lastStoredMessage = message
  }
}

function sourceLabel(data) {
  var pkg = String(data && (data.sourcePackage || data.packageName || '')).toLowerCase()
  if (pkg.indexOf('baidu') >= 0) return '百度地图'
  if (pkg.indexOf('autonavi') >= 0) return '高德地图'
  return '系统导航'
}

function bridgeId() {
  var ss = getSettingsStorage()
  var existing = ss && ss.getItem ? ss.getItem('_rm_bridge_id') : ''
  if (existing) return String(existing)
  var value = 'bridge-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
  if (ss) ss.setItem('_rm_bridge_id', value)
  return value
}

var currentBridgeId = bridgeId()

function sendToWatchPacket(packet) {
  if (!packet) return
  try {
    var sentAt = Date.now()
    packet.bridgeSentAt = sentAt
    packet.appSideWatchSentAt = sentAt
    var delivery = messageBuilder.call(packet)
    if (delivery && typeof delivery.catch === 'function') {
      delivery.catch(function(error) {
        console.log('RingMap: watch message failed', error)
      })
    }
  } catch (e) {
    console.log('RingMap: watch message failed', e)
  }
}

function cancelPendingWatchSnapshot() {
  pendingWatchSnapshot = false
  if (watchSnapshotTimer !== null) {
    clearTimeout(watchSnapshotTimer)
    watchSnapshotTimer = null
  }
}

function cancelWakeResyncTimeout() {
  if (wakeResyncTimer !== null) {
    clearTimeout(wakeResyncTimer)
    wakeResyncTimer = null
  }
}

function recoveryMatches(packet, recovery) {
  return !!packet && !!recovery
    && String(packet.recoveryId || '') === recovery.recoveryId
    && Number(packet.watchReadyAt || 0) === recovery.watchReadyAt
}

function markAuthorityResponse(packet) {
  if (!recoveryMatches(packet, wakeRecovery)) return false
  authorityResponseRevision++
  wakeRecovery = null
  cancelWakeResyncTimeout()
  return true
}

function scheduleWakeRecoveryTimeout(recovery) {
  cancelWakeResyncTimeout()
  wakeResyncTimer = setTimeout(function() {
    wakeResyncTimer = null
    if (destroyed || wakeRecovery !== recovery || connectionState !== 'open'
        || connectionEpoch !== recovery.connectionEpoch
        || authorityResponseRevision !== recovery.responseRevision) return
    resyncPending = true
    reconnectNow('唤醒后未收到 Android 状态，正在重连')
  }, WAKE_RESYNC_TIMEOUT_MS)
}

function dispatchWakeRecovery(reason) {
  var recovery = wakeRecovery
  if (!recovery || connectionState !== 'open') return false
  recovery.connectionEpoch = connectionEpoch
  recovery.responseRevision = authorityResponseRevision
  var sent = requestLatest(reason || 'app_side_run', recovery)
  if (!sent) return false
  resyncPending = false
  scheduleWakeRecoveryTimeout(recovery)
  return true
}

function beginWakeRecovery(sourcePacket, reason) {
  cancelWakeResyncTimeout()
  // watch_sleep is the only authoritative inactive signal. onRun may race a
  // fresh watch_ready packet, so it must not suppress the next live snapshot.
  var now = Date.now()
  var recoveryId = String(sourcePacket && sourcePacket.recoveryId
    || ('app-side-wake-' + now + '-' + Math.floor(Math.random() * 1000000)))
  var watchReadyAt = Number(sourcePacket && sourcePacket.watchReadyAt || now)
  activeRecoveryId = recoveryId
  activeWatchReadyAt = watchReadyAt
  wakeRecovery = {
    recoveryId: recoveryId,
    watchReadyAt: watchReadyAt,
    connectionEpoch: connectionEpoch,
    responseRevision: authorityResponseRevision
  }
  resyncPending = true
  if (connectionState !== 'open') {
    connectWebSocket()
    return
  }
  dispatchWakeRecovery(reason || 'app_side_run')
}

function flushWatchSnapshot() {
  watchSnapshotTimer = null
  if (!pendingWatchSnapshot) return
  pendingWatchSnapshot = false
  var packet = cachedNavigationForWatch(1000)
  if (!packet) {
    clearCachedNavigation()
    requestLatest('expired_snapshot')
    return
  }
  sendToWatchPacket(packet)
}

function queueWatchSnapshot() {
  pendingWatchSnapshot = true
  // Older ZeppOS builds do not emit lifecycle notices. Preserve their initial
  // real-time delivery, but once the watch has declared sleep, cache only latest.
  if ((watchActivityKnown && !watchActive) || watchSnapshotTimer !== null) return
  watchSnapshotTimer = setTimeout(flushWatchSnapshot, WATCH_SNAPSHOT_COALESCE_MS)
}

function sleepMatchesActiveGeneration(packet) {
  if (!watchActivityKnown) return true
  if (!activeRecoveryId && !activeWatchReadyAt) return true
  return !!packet
    && String(packet.recoveryId || '') === activeRecoveryId
    && Number(packet.watchReadyAt || 0) === activeWatchReadyAt
}

function setWatchActive(active) {
  var hadPendingSnapshot = pendingWatchSnapshot
  watchActivityKnown = true
  watchActive = !!active
  if (watchActive && hadPendingSnapshot && watchSnapshotTimer === null) {
    flushWatchSnapshot()
  }
  return hadPendingSnapshot
}

function sendBridgeState(status, message) {
  sendToWatchPacket({
    protocolVersion: 2,
    type: 'bridge_state',
    status: status,
    message: message || '',
    bridgeId: currentBridgeId,
    bridgeOrigin: 'app_side',
    emittedAt: Date.now()
  })
}

function sendToAndroid(packet) {
  if (!ws || connectionState !== 'open') return false
  try {
    ws.send(JSON.stringify(packet))
    return true
  } catch (e) {
    console.log('RingMap: Android send failed', e)
    markDisconnected(connectionEpoch, ws, 'error', 'Android 导航桥发送失败')
    return false
  }
}

function requestLatest(reason, sourcePacket) {
  var current = lastNavData || {}
  var sent = sendToAndroid({
    protocolVersion: 2,
    type: 'resync',
    bridgeId: currentBridgeId,
    recoveryId: sourcePacket && sourcePacket.recoveryId || activeRecoveryId || '',
    watchReadyAt: Number(sourcePacket && sourcePacket.watchReadyAt || activeWatchReadyAt || 0),
    reason: reason || 'watch_request',
    sessionId: sourcePacket && sourcePacket.sessionId || current.sessionId || '',
    seq: sourcePacket && sourcePacket.seq || current.seq || 0,
    emittedAt: Date.now()
  })
  if (!sent) resyncPending = true
  return sent
}

function snapshotTtl(packet) {
  var ttl = Number(packet && packet.ttlMs || 45000)
  return Math.max(1000, Math.min(120000, ttl))
}

function cachedNavigationRemainingMs() {
  if (!lastNavData || lastNavDataAt <= 0) return 0
  var emittedAt = Number(lastNavData.emittedAt || 0)
  var base = emittedAt > 0 ? emittedAt : lastNavDataAt
  return base + snapshotTtl(lastNavData) - Date.now()
}

function hasFreshCachedNavigation() {
  return cachedNavigationRemainingMs() >= MIN_CACHE_REPLAY_MS
}

function cachedNavigationForWatch(minimumRemainingMs) {
  var minimum = Number(minimumRemainingMs || MIN_CACHE_REPLAY_MS)
  var remaining = cachedNavigationRemainingMs()
  if (remaining < minimum) return null
  var packet = {}
  Object.keys(lastNavData).forEach(function(key) { packet[key] = lastNavData[key] })
  packet.ttlMs = Math.max(1000,
    Math.min(snapshotTtl(lastNavData), Math.floor(remaining)))
  return packet
}

function rememberNavigation(packet) {
  lastNavData = packet
  lastNavDataAt = Date.now()
  var storage = getSettingsStorage()
  try {
    var value = JSON.stringify(packet)
    if (storage) {
      storage.setItem(NAV_CACHE_KEY, value)
      storage.setItem(NAV_CACHE_AT_KEY, String(lastNavDataAt))
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NAV_CACHE_KEY, value)
      localStorage.setItem(NAV_CACHE_AT_KEY, String(lastNavDataAt))
    }
  } catch (e) {
    console.log('RingMap: navigation cache write failed', e)
  }
}

function restoreCachedNavigation() {
  var storage = getSettingsStorage()
  try {
    var raw = storage ? storage.getItem(NAV_CACHE_KEY) : localStorage.getItem(NAV_CACHE_KEY)
    var cachedAt = Number(storage ? storage.getItem(NAV_CACHE_AT_KEY) : localStorage.getItem(NAV_CACHE_AT_KEY))
    if (!raw || !cachedAt) return
    var packet = JSON.parse(raw)
    lastNavData = packet
    lastNavDataAt = cachedAt
    if (!hasFreshCachedNavigation()) clearCachedNavigation()
  } catch (e) {
    clearCachedNavigation()
  }
}

function clearCachedNavigation() {
  lastNavData = null
  lastNavDataAt = 0
  removeStorageItem('rm_nav')
  removeStorageItem(NAV_CACHE_KEY)
  removeStorageItem(NAV_CACHE_AT_KEY)
  setStatus('idle', '等待系统导航')
}

function handleProtocolPacket(packet) {
  if (!packet || typeof packet !== 'object') return
  packet.bridgeReceivedAt = Date.now()
  packet.appSideReceivedAt = packet.bridgeReceivedAt

  if (packet.type === 'nav_snapshot') {
    markAuthorityResponse(packet)
    packet.sourceName = packet.sourceName || sourceLabel(packet)
    rememberNavigation(packet)
    var watchPacket = cachedNavigationForWatch(1000)
    if (!watchPacket) {
      clearCachedNavigation()
      requestLatest('expired_snapshot')
      return
    }
    // A short coalescing window prevents a suspended phone-watch transport
    // from replaying every queued Android refresh after the watch wakes.
    queueWatchSnapshot()
    setStatus('navigating', '导航数据已同步')
    return
  }

  if (packet.type === 'nav_end') {
    markAuthorityResponse(packet)
    if (!lastNavData || lastNavData.sessionId === packet.sessionId) {
      cancelPendingWatchSnapshot()
      clearCachedNavigation()
    }
    setStatus('idle', '导航已结束')
    sendToWatchPacket(packet)
    return
  }

  if (packet.type === 'idle') {
    markAuthorityResponse(packet)
    cancelPendingWatchSnapshot()
    clearCachedNavigation()
    setStatus('idle', '等待系统导航')
    sendToWatchPacket(packet)
    return
  }

  if (packet.type === 'bridge_state') {
    sendToWatchPacket(packet)
    return
  }

  if (packet.type === 'pong') {
    lastPongAt = Date.now()
    lastPingAt = 0
    setStatus('connected', 'Android 导航桥在线')
  }
}

function bufferToString(buffer) {
  var bytes = new Uint8Array(buffer)
  var text = ''
  for (var index = 0; index < bytes.length; index++) {
    text += String.fromCharCode(bytes[index])
  }
  try { return decodeURIComponent(escape(text)) } catch (e) { return text }
}

function frameToText(data) {
  if (typeof data === 'string') return Promise.resolve(data)
  if (data && data.text) return data.text()
  if (data && data.arrayBuffer) {
    return data.arrayBuffer().then(function(buffer) { return bufferToString(buffer) })
  }
  return Promise.resolve(String(data || ''))
}

function handleFrameText(text) {
  if (!text) return
  try {
    handleProtocolPacket(JSON.parse(text))
  } catch (e) {
    // 仅为 Android 2.x 升级窗口保留；协议 v2 发布后不再产生裸信号。
    if (text === 'navend' && lastNavData) {
      handleProtocolPacket({
        protocolVersion: 2,
        type: 'nav_end',
        sessionId: lastNavData.sessionId,
        sessionStartedAt: lastNavData.sessionStartedAt,
        seq: Number(lastNavData.seq || 0) + 1,
        emittedAt: Date.now()
      })
    }
  }
}

function isCurrentSocket(epoch, socket) {
  return !destroyed && epoch === connectionEpoch && socket === ws
}

function cancelReconnect() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function cancelHeartbeat() {
  if (heartbeatTimer !== null) {
    clearTimeout(heartbeatTimer)
    heartbeatTimer = null
  }
}

function markDisconnected(epoch, socket, status, message) {
  if (destroyed || epoch !== connectionEpoch || socket !== ws) return
  connectionEpoch++
  ws = null
  connectionState = 'disconnected'
  lastPingAt = 0
  lastPongAt = 0
  cancelHeartbeat()
  cancelWakeResyncTimeout()
  if (wakeRecovery) resyncPending = true
  setStatus(status || 'disconnected', message || '连接已断开')
  sendBridgeState(status || 'disconnected', message || '连接已断开')
  try { socket.close() } catch (e) {}
  scheduleReconnect()
}

function reconnectNow(message) {
  if (destroyed) return
  cancelReconnect()
  cancelHeartbeat()
  cancelWakeResyncTimeout()
  var socket = ws
  connectionEpoch++
  ws = null
  connectionState = 'disconnected'
  lastPingAt = 0
  lastPongAt = 0
  messageQueue = Promise.resolve()
  if (socket) {
    try { socket.close() } catch (e) {}
  }
  setStatus('connecting', message || '正在恢复 Android 导航桥')
  sendBridgeState('connecting', message || '正在恢复 Android 导航桥')
  connectWebSocket()
}

function scheduleHeartbeat(epoch, socket) {
  cancelHeartbeat()
  heartbeatTimer = setTimeout(function heartbeat() {
    heartbeatTimer = null
    if (!isCurrentSocket(epoch, socket) || connectionState !== 'open') return
    var now = Date.now()
    if (lastPingAt > 0) {
      if (now - lastPingAt > PONG_TIMEOUT_MS) {
        markDisconnected(epoch, socket, 'disconnected', 'Android 导航桥心跳超时')
        return
      }
      scheduleHeartbeat(epoch, socket)
      return
    }
    lastPingAt = now
    if (!sendToAndroid({
      protocolVersion: 2,
      type: 'ping',
      bridgeId: currentBridgeId,
      emittedAt: now
    })) return
    scheduleHeartbeat(epoch, socket)
  }, HEARTBEAT_INTERVAL_MS)
}

function scheduleReconnect() {
  if (destroyed || reconnectTimer !== null || connectionState === 'open'
      || connectionState === 'connecting') return
  var index = Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)
  var base = RECONNECT_DELAYS[index]
  var jitter = Math.floor(base * 0.15 * (Math.random() * 2 - 1))
  reconnectAttempt++
  reconnectTimer = setTimeout(function() {
    reconnectTimer = null
    connectWebSocket()
  }, Math.max(500, base + jitter))
}

function connectWebSocket() {
  if (destroyed || connectionState === 'open' || connectionState === 'connecting') return
  cancelReconnect()
  connectionState = 'connecting'
  messageQueue = Promise.resolve()
  var epoch = ++connectionEpoch
  var socket

  try {
    socket = new WebSocket(WS_URL)
    ws = socket
  } catch (e) {
    connectionState = 'disconnected'
    ws = null
    setStatus('error', 'Android 导航桥不可用')
    sendBridgeState('error', '连接创建失败')
    scheduleReconnect()
    return
  }

  socket.onopen = function() {
    if (!isCurrentSocket(epoch, socket)) return
    connectionState = 'open'
    reconnectAttempt = 0
    lastPongAt = Date.now()
    lastPingAt = 0
    setStatus('connected', '已连接 Android 导航桥')
    sendBridgeState('connected', 'Android 导航桥在线')
    sendToAndroid({
      protocolVersion: 2,
      type: 'hello',
      bridgeId: currentBridgeId,
      sessionId: lastNavData && lastNavData.sessionId || '',
      seq: lastNavData && lastNavData.seq || 0,
      emittedAt: Date.now()
    })
    if (wakeRecovery) {
      dispatchWakeRecovery('pending_recovery')
    } else if (resyncPending) {
      resyncPending = false
      requestLatest('pending_recovery')
    }
    scheduleHeartbeat(epoch, socket)
  }

  socket.onmessage = function(event) {
    if (!isCurrentSocket(epoch, socket) || !event || event.data === undefined) return
    messageQueue = messageQueue
      .then(function() { return frameToText(event.data) })
      .then(function(text) {
        if (isCurrentSocket(epoch, socket)) handleFrameText(text)
      })
      .catch(function(error) { console.log('RingMap: frame decode failed', error) })
  }

  socket.onclose = function() {
    markDisconnected(epoch, socket, 'disconnected', '连接已断开')
  }

  socket.onerror = function() {
    markDisconnected(epoch, socket, 'error', 'Android 导航桥连接错误')
  }
}

function forwardDevicePacket(packet) {
  if (!packet) return
  if (packet.type === 'watch_sleep') {
    if (sleepMatchesActiveGeneration(packet)) setWatchActive(false)
    return
  }
  if (packet.type === 'watch_ready' || packet.type === 'resync') {
    activeRecoveryId = String(packet.recoveryId || activeRecoveryId)
    activeWatchReadyAt = Number(packet.watchReadyAt || activeWatchReadyAt || Date.now())
    var deliveredPendingSnapshot = setWatchActive(true)
    if (connectionState === 'open') {
      sendBridgeState('connected', 'Android 导航桥在线')
    }
    var cachedPacket = cachedNavigationForWatch()
    if (!deliveredPendingSnapshot && cachedPacket) sendToWatchPacket(cachedPacket)
    beginWakeRecovery(packet, packet.type)
    return
  }
  if (packet.type === 'nav_ack') {
    packet.protocolVersion = 2
    packet.bridgeId = currentBridgeId
    packet.bridgeForwardedAt = Date.now()
    sendToAndroid(packet)
  }
}

function ensureDeviceMessageBridge() {
  if (messageBridgeInitialized) return
  messageBridgeInitialized = true
  messageBuilder.listen(function() {})
  messageBuilder.on('call', function(context) {
    try {
      forwardDevicePacket(messageBuilder.buf2Json(context.payload))
    } catch (e) {
      console.log('RingMap: device message parse error', e)
    }
  })
}

AppSideService({
  onInit() {
    destroyed = false
    restoreCachedNavigation()
    ensureDeviceMessageBridge()
    setStatus('disconnected', '正在连接 Android 导航桥')
    connectWebSocket()
  },

  onRun() {
    beginWakeRecovery()
  },

  onDestroy() {
    destroyed = true
    watchActive = false
    activeRecoveryId = ''
    activeWatchReadyAt = 0
    wakeRecovery = null
    connectionEpoch++
    cancelReconnect()
    cancelHeartbeat()
    cancelWakeResyncTimeout()
    cancelPendingWatchSnapshot()
    connectionState = 'disconnected'
    messageQueue = Promise.resolve()
    var socket = ws
    ws = null
    if (socket) {
      try { socket.close() } catch (e) {}
    }
    setStatus('disconnected', 'Android 导航桥已停止')
  }
})
