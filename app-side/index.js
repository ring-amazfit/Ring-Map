/**
 * RingMap App-Side - Android WebSocket 与 ZeppOS MessageBuilder 的唯一中继。
 * Android 是导航会话权威；本层只缓存和转发最新协议快照。
 */

import { MessageBuilder } from '../shared/message-side'

var WS_URL = 'ws://127.0.0.1:8886'
var RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]
var messageBuilder = new MessageBuilder()
var ws = null
var connectionState = 'disconnected'
var connectionEpoch = 0
var reconnectTimer = null
var heartbeatTimer = null
var reconnectAttempt = 0
var destroyed = false
var lastNavData = null
var messageQueue = Promise.resolve()

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
  setStorageItem('_rm_status', status)
  setStorageItem('rm_status', status)
  if (message !== undefined) {
    setStorageItem('_rm_msg', message)
    setStorageItem('rm_msg', message)
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
    packet.bridgeSentAt = Date.now()
    messageBuilder.call(packet)
  } catch (e) {
    console.log('RingMap: watch message failed', e)
  }
}

function sendBridgeState(status, message) {
  sendToWatchPacket({
    protocolVersion: 2,
    type: 'bridge_state',
    status: status,
    message: message || '',
    bridgeId: currentBridgeId,
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
    return false
  }
}

function requestLatest(reason, sourcePacket) {
  var current = lastNavData || {}
  sendToAndroid({
    protocolVersion: 2,
    type: 'resync',
    bridgeId: currentBridgeId,
    reason: reason || 'watch_request',
    sessionId: sourcePacket && sourcePacket.sessionId || current.sessionId || '',
    seq: sourcePacket && sourcePacket.seq || current.seq || 0,
    emittedAt: Date.now()
  })
}

function clearCachedNavigation() {
  lastNavData = null
  removeStorageItem('rm_nav')
  setStorageItem('rm_status', 'idle')
}

function handleProtocolPacket(packet) {
  if (!packet || typeof packet !== 'object') return
  packet.bridgeReceivedAt = Date.now()

  if (packet.type === 'nav_snapshot') {
    packet.sourceName = packet.sourceName || sourceLabel(packet)
    lastNavData = packet
    setStatus('navigating', '导航数据已同步')
    sendToWatchPacket(packet)
    return
  }

  if (packet.type === 'nav_end') {
    if (!lastNavData || lastNavData.sessionId === packet.sessionId) clearCachedNavigation()
    setStatus('idle', '导航已结束')
    sendToWatchPacket(packet)
    return
  }

  if (packet.type === 'idle') {
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

function scheduleHeartbeat(epoch, socket) {
  cancelHeartbeat()
  heartbeatTimer = setTimeout(function heartbeat() {
    heartbeatTimer = null
    if (!isCurrentSocket(epoch, socket) || connectionState !== 'open') return
    sendToAndroid({
      protocolVersion: 2,
      type: 'ping',
      bridgeId: currentBridgeId,
      emittedAt: Date.now()
    })
    scheduleHeartbeat(epoch, socket)
  }, 10000)
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
    scheduleHeartbeat(epoch, socket)
  }

  socket.onmessage = function(event) {
    if (!isCurrentSocket(epoch, socket) || !event || event.data === undefined) return
    messageQueue = messageQueue
      .then(function() { return frameToText(event.data) })
      .then(handleFrameText)
      .catch(function(error) { console.log('RingMap: frame decode failed', error) })
  }

  socket.onclose = function() {
    if (!isCurrentSocket(epoch, socket)) return
    connectionState = 'disconnected'
    ws = null
    cancelHeartbeat()
    setStatus('disconnected', '正在恢复 Android 导航桥')
    sendBridgeState('disconnected', '连接已断开')
    scheduleReconnect()
  }

  socket.onerror = function() {
    if (!isCurrentSocket(epoch, socket)) return
    connectionState = 'disconnected'
    ws = null
    cancelHeartbeat()
    setStatus('error', 'Android 导航桥连接错误')
    sendBridgeState('error', '连接错误')
    try { socket.close() } catch (e) {}
    scheduleReconnect()
  }
}

function forwardDevicePacket(packet) {
  if (!packet) return
  if (packet.type === 'watch_ready' || packet.type === 'resync') {
    requestLatest(packet.type, packet)
    return
  }
  if (packet.type === 'nav_ack') {
    packet.protocolVersion = 2
    packet.bridgeId = currentBridgeId
    packet.bridgeForwardedAt = Date.now()
    sendToAndroid(packet)
  }
}

AppSideService({
  onInit() {
    destroyed = false
    messageBuilder.listen(function() {})
    messageBuilder.on('call', function(context) {
      try {
        forwardDevicePacket(messageBuilder.buf2Json(context.payload))
      } catch (e) {
        console.log('RingMap: device message parse error', e)
      }
    })
    setStatus('disconnected', '正在连接 Android 导航桥')
    connectWebSocket()
  },

  onRun() {
    connectWebSocket()
  },

  onDestroy() {
    destroyed = true
    connectionEpoch++
    cancelReconnect()
    cancelHeartbeat()
    connectionState = 'disconnected'
    var socket = ws
    ws = null
    if (socket) {
      try { socket.close() } catch (e) {}
    }
    setStatus('idle', '')
  }
})
