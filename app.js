import { MessageBuilder } from './shared/message'
import { getPackageInfo } from '@zos/app'
import { localStorage } from '@zos/storage'
import { push } from '@zos/router'
import * as ble from '@zos/ble'

var APP_ID = 1121554
var KEY_NAV = 'rm_nav'
var KEY_STATUS = 'rm_status'
var KEY_TS = 'rm_nav_ts'
var builder = null
var appData = {
  messageBuilder: null,
  navPageActive: false,
  navPageRefresh: null,
  homePageRefresh: null,
  navRoutePending: false,
  navSession: 0,
  requestLatestNav: requestLatestNav
}

function sendWatchReady() {
  if (!builder) return
  try {
    builder.call({ type: 'watch_ready', ts: Date.now(), source: 'watch' })
  } catch (e) {
    console.log('RingMap: ready message failed', e)
  }
}

function requestLatestNav() {
  if (!builder) return
  try {
    builder.call({ type: 'nav_request', ts: Date.now(), source: 'watch' })
  } catch (e) {
    console.log('RingMap: nav request failed', e)
  }
}

function autoOpenEnabled() {
  return localStorage.getItem('rm_auto_open') !== '0'
}

function openNavigationPage() {
  if (!autoOpenEnabled() || appData.navPageActive || appData.navRoutePending) return
  appData.navRoutePending = true
  setTimeout(function() {
    try {
      push({ url: 'page/navigation', anim: false })
    } catch (e) {
      appData.navRoutePending = false
      console.log('RingMap: navigation page open failed', e)
    }
  }, 0)
}

function publishNavigation(data) {
  if (!data) return
  if (!appData.navSession) appData.navSession = Date.now()
  data.session = appData.navSession
  localStorage.setItem(KEY_NAV, JSON.stringify(data))
  localStorage.setItem(KEY_TS, String(data.ts || Date.now()))
  localStorage.setItem(KEY_STATUS, 'navigating')

  if (typeof appData.homePageRefresh === 'function') appData.homePageRefresh(data)
  if (appData.navPageActive && typeof appData.navPageRefresh === 'function') {
    appData.navPageRefresh(data)
  } else {
    openNavigationPage()
  }
}

function endNavigation() {
  appData.navSession = 0
  appData.navRoutePending = false
  localStorage.removeItem(KEY_NAV)
  localStorage.removeItem(KEY_TS)
  localStorage.setItem(KEY_STATUS, 'idle')
  if (typeof appData.homePageRefresh === 'function') appData.homePageRefresh(null)
  if (appData.navPageActive && typeof appData.navPageRefresh === 'function') {
    appData.navPageRefresh(null)
  }
}

function handleWatchPacket(packet) {
  if (!packet) return
  if (packet.type === 'bridge_ready') {
    requestLatestNav()
  } else if (packet.type === 'nav' && packet.data) {
    publishNavigation(packet.data)
    try {
      builder.call({
        type: 'nav_ack',
        ts: packet.data.ts || Date.now(),
        source: 'watch'
      })
    } catch (e) {}
  } else if (packet.type === 'nav_end') {
    endNavigation()
    sendWatchReady()
  }
}

App({
  globalData: appData,

  onCreate() {
    console.log('RingMap onCreate appId=' + APP_ID)
    getPackageInfo()
    builder = new MessageBuilder({
      appId: APP_ID,
      appDevicePort: 20,
      appSidePort: 0,
      ble: ble
    })
    appData.messageBuilder = builder

    // 页面切换不会影响全局桥接；导航页注册回调后，新的步骤直接刷新控件。
    builder.on('call', function(ctx) {
      try {
        handleWatchPacket(builder.buf2Json(ctx.payload))
      } catch (e) {
        console.log('RingMap: global message error', e)
      }
    })

    builder.connect(function() {
      sendWatchReady()
      requestLatestNav()
    })
  },

  onDestroy() {
    console.log('RingMap onDestroy')
    if (builder) builder.disConnect()
    builder = null
    appData.messageBuilder = null
    appData.navPageActive = false
    appData.navPageRefresh = null
    appData.homePageRefresh = null
    appData.navRoutePending = false
    appData.navSession = 0
    appData.requestLatestNav = requestLatestNav
  }
})
