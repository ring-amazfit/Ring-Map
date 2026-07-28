/**
 * RingMap App-Side — WebSocket 中继器
 * 
 * 职责：连接 Android 配套 App 的 WebSocket → 收到导航数据 → 写入 localStorage 供手表读取
 * 
 * 架构：
 *   Android App（系统高德通知）→ WebSocket ws://127.0.0.1:8886 → 本文件
 *   → MessageBuilder → 手表 page/home.js；localStorage 作为兼容缓存
 * 
 * 手表端不做任何 GPS/路线规划/API 调用，只读取 localStorage 显示导航数据。
 */

import { MessageBuilder } from '../shared/message-side'

var WS_URL = 'ws://127.0.0.1:8886'
var RECONNECT_DELAY = 2000
var messageBuilder = new MessageBuilder()

function getSettingsStorage() {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      return settings.settingsStorage
    }
  } catch (e) {}
  return null
}

function setStatus(status, msg) {
  var ss = getSettingsStorage()
  if (ss) {
    ss.setItem('_rm_status', status)
    if (msg !== undefined) ss.setItem('_rm_msg', msg)
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rm_status', status)
      if (msg !== undefined) localStorage.setItem('rm_msg', msg)
    }
  } catch (e) {}
}

function sendToWatch(type, data) {
  try {
    messageBuilder.call({
      type: type,
      data: data || {},
      ts: Date.now()
    })
  } catch (e) {
    console.log('RingMap: watch message failed', e)
  }
}

function sourceLabel(data) {
  var pkg = String(data && (data.sourcePackage || data.packageName || data.mapSource || '')).toLowerCase()
  if (pkg.indexOf('baidu') >= 0) return '百度地图'
  return '高德地图'
}

function setNavData(data) {
  if (!data) return
  data.sourceLabel = data.sourceLabel || sourceLabel(data)
  lastNavData = data
  var ss = getSettingsStorage()
  if (ss) {
    ss.setItem('_rm_status', 'navigating')
    ss.setItem('_rm_msg', '导航中: ' + (data.instruction || data.action || ''))
  }
  sendToWatch('nav', data)
}

function clearNavData() {
  lastNavData = null
  sendToWatch('nav_end', {})
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('rm_nav')
      localStorage.setItem('rm_status', 'idle')
    }
  } catch (e) {}
  setStatus('idle', '')
}

var ws = null
var wsConnected = false
var lastNavData = null

function sendWatchAckToAndroid(data) {
  if (!ws || !wsConnected) return
  try {
    ws.send(JSON.stringify({
      type: 'watch_ack',
      ts: Date.now(),
      source: data && data.source ? data.source : 'watch'
    }))
  } catch (e) {
    console.log('RingMap: watch ack failed', e)
  }
}

function connectWebSocket() {
  try {
    ws = new WebSocket(WS_URL)

    ws.onopen = function() {
      wsConnected = true
      messageBuilder.call({ type: 'bridge_ready', ts: Date.now() })
      console.log('RingMap: WebSocket connected to Android app')
      setStatus('connected', '已连接 Android 导航 App')
    }

    ws.onmessage = function(evt) {
      if (!evt || !evt.data) return

      // 检查是否为小数据包（状态信号）
      if (evt.data.size <= 1 || evt.data.length <= 1) {
        // 导航结束信号
        clearNavData()
        setStatus('idle', '导航已结束')
        return
      }

      // 解析 JSON 导航数据
      try {
        var text = evt.data
        if (typeof evt.data !== 'string') {
          // Blob/ArrayBuffer → string
          if (evt.data.text) {
            evt.data.text().then(function(t) {
              handleNavText(t)
            })
            return
          } else if (evt.data.arrayBuffer) {
            evt.data.arrayBuffer().then(function(buf) {
              var text = bufferToString(buf)
              handleNavText(text)
            })
            return
          }
        }
        handleNavText(text)
      } catch (e) {
        console.log('RingMap: parse error:', e)
      }
    }

    ws.onclose = function() {
      wsConnected = false
      console.log('RingMap: WebSocket closed, reconnecting...')
      setStatus('disconnected', 'Android App 未连接，等待重连...')
      setTimeout(connectWebSocket, RECONNECT_DELAY)
    }

    ws.onerror = function() {
      wsConnected = false
      setStatus('error', 'WebSocket 连接错误')
    }

  } catch (e) {
    console.log('RingMap: WebSocket init error:', e)
    setStatus('error', 'WebSocket 不可用: ' + (e.message || e))
    setTimeout(connectWebSocket, RECONNECT_DELAY)
  }
}

function bufferToString(buf) {
  var arr = new Uint8Array(buf)
  var str = ''
  for (var i = 0; i < arr.length; i++) {
    str += String.fromCharCode(arr[i])
  }
  try { return decodeURIComponent(escape(str)) } catch (e) { return str }
}

function handleNavText(text) {
  try {
    var data = JSON.parse(text)
    setNavData(data)
    console.log('RingMap: nav data:', data.action, data.road, data.distance)
  } catch (e) {
    // 非 JSON，可能是纯文本状态信号
    if (text === 'navend' || text === 'wclose') {
      clearNavData()
    } else if (text === 'wconnected') {
      setStatus('connected', '已连接 Android 导航 App')
    }
  }
}

AppSideService({
  onInit() {
    console.log('RingMap App-Side onInit')
    messageBuilder.listen(function() {})
    messageBuilder.on('call', function(ctx) {
      try {
        var data = messageBuilder.buf2Json(ctx.payload)
        if (data && data.type === 'watch_ready') {
          sendWatchAckToAndroid(data)
          setStatus('connected', '已连接 · 等待手机导航')
        } else if (data && data.type === 'nav_ack') {
          sendWatchAckToAndroid(data)
        } else if (data && data.type === 'nav_request' && lastNavData) {
          sendToWatch('nav', lastNavData)
        }
      } catch (e) {
        console.log('RingMap: device message parse error', e)
      }
    })
    setStatus('disconnected', '正在连接 Android App...')
    connectWebSocket()
  },

  onRun() {
    if (!wsConnected) {
      connectWebSocket()
    }
  },

  onDestroy() {
    if (ws) {
      try { ws.close() } catch (e) {}
    }
    setStatus('idle', '')
  }
})
