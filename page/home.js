import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { push } from '@zos/router'
import { localStorage } from '@zos/storage'
import { applySavedScreenSetting } from '../utils/settings'
import { drawThemeBackground } from '../utils/theme'
import { actionIcon, actionTitle, createActionIcon, deleteAll } from '../utils/icons'

var TEXT = 0xF6FAF8
var SUB = 0xB5C2C8
var MUTED = 0x6F7C83
var CYAN = 0x2EDCF2
var PANEL = 0x0A1013
var PRESS = 0x152126

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size),
    color: color, align_h: alignH || align.CENTER_H,
    align_v: align.CENTER_V, text: value || ''
  })
}

function distanceText(nav) {
  if (!nav) return ''
  if (nav.distanceText) return String(nav.distanceText)
  var meters = Number(nav.distanceMeters || nav.distance || 0)
  if (!meters) return ''
  return meters < 1000 ? Math.round(meters) + '米' : (meters / 1000).toFixed(1) + '公里'
}

Page({
  state: { iconWidgets: [], lastAction: '', distance: null, action: null, status: null, detail: null },

  onInit() {
    applySavedScreenSetting()
  },

  build() {
    var self = this
    drawThemeBackground(480)
    text(110, 24, 260, 24, 18, TEXT, 'RINGMAP')
    self.state.status = text(92, 55, 296, 22, 12, CYAN, '正在检查连接')
    self.state.distance = text(50, 242, 380, 68, 54, TEXT, '')
    self.state.action = text(66, 310, 348, 34, 23, TEXT, '等待导航')
    self.state.detail = text(78, 348, 324, 22, 13, SUB, '等待手机导航桥')

    createWidget(widget.BUTTON, {
      x: px(72), y: px(386), w: px(150), h: px(44), radius: px(8),
      text_size: px(15), color: TEXT, normal_color: PANEL, press_color: PRESS,
      text: '导航', click_func: function() {
        var appData = getApp()._options.globalData
        push({ url: appData.watchActivated ? 'page/navigation' : 'page/activation', anim: true })
      }
    })
    createWidget(widget.BUTTON, {
      x: px(258), y: px(386), w: px(150), h: px(44), radius: px(8),
      text_size: px(15), color: TEXT, normal_color: PANEL, press_color: PRESS,
      text: '设置', click_func: function() {
        var appData = getApp()._options.globalData
        push({ url: appData.watchActivated ? 'page/settings' : 'page/activation', anim: true })
      }
    })

    var appData = getApp()._options.globalData
    appData.homePageRefresh = function(nav, navState) { self.renderState(nav, navState) }
    self.refreshCurrentState()
    if (typeof appData.requestLatestNav === 'function') appData.requestLatestNav()
    if (appData.resumeNavigationOnHome) {
      appData.resumeNavigationOnHome = false
      if (typeof appData.openNavigationPage === 'function') appData.openNavigationPage()
    }
    if (appData.navState && appData.navState.status === 'active'
        && typeof appData.openNavigationPage === 'function') {
      appData.openNavigationPage()
    }
  },

  refreshCurrentState() {
    var appData = getApp()._options.globalData
    if (appData.navState && appData.navState.status === 'active' && appData.navState.snapshot) {
      this.renderState(appData.navState.snapshot, appData.navState)
      return
    }
    var raw = localStorage.getItem('rm_nav')
    if (raw) {
      try {
        this.renderState(JSON.parse(raw), appData.navState)
        return
      } catch (e) {}
    }
    this.renderState(null, appData.navState)
  },

  renderIcon(action) {
    var type = actionIcon(action)
    if (type === this.state.lastAction) return
    this.state.lastAction = type
    deleteAll(this.state.iconWidgets)
    if (type === 'wait') return
    this.state.iconWidgets.push(createActionIcon(type, 164, 88, 152))
  },

  renderState(nav, navState) {
    var appData = getApp()._options.globalData
    var state = navState || appData.navState || { status: 'idle', bridgeStatus: 'disconnected' }
    if (!appData.watchActivated) {
      this.state.status.setProperty(prop.MORE, { text: '需要激活', color: CYAN })
      this.state.distance.setProperty(prop.MORE, { text: '' })
      this.state.action.setProperty(prop.MORE, { text: '连接手机后激活', color: TEXT })
      this.state.detail.setProperty(prop.MORE, { text: '点击导航，扫码下载 Android 配套端', color: SUB })
      this.renderIcon('wait')
      return
    }
    if (nav && state.status === 'active') {
      var type = actionIcon(nav.action)
      this.state.status.setProperty(prop.MORE, {
        text: String(nav.sourceName || nav.sourceLabel || '系统导航') + ' · LIVE', color: CYAN
      })
      this.state.distance.setProperty(prop.MORE, { text: distanceText(nav), color: TEXT })
      this.state.action.setProperty(prop.MORE, { text: actionTitle(type), color: TEXT })
      this.state.detail.setProperty(prop.MORE, {
        text: nav.road ? String(nav.road).substring(0, 18) : '会话 #' + String(nav.seq || '—'), color: SUB
      })
      this.renderIcon(type)
      var appData = getApp()._options.globalData
      if (typeof appData.markApplied === 'function') appData.markApplied(nav)
      return
    }

    var stale = state.status === 'stale'
    var connected = state.bridgeStatus === 'connected'
    this.state.status.setProperty(prop.MORE, {
      text: connected ? '手机导航桥在线' : '等待手机导航桥', color: connected ? CYAN : MUTED
    })
    this.state.distance.setProperty(prop.MORE, { text: '' })
    this.state.action.setProperty(prop.MORE, { text: stale ? '等待新指令' : '等待导航', color: TEXT })
    this.state.detail.setProperty(prop.MORE, {
      text: stale ? '旧方向已隐藏' : connected ? '开始手机导航即可同步' : '正在自动重连', color: SUB
    })
    this.renderIcon('wait')
  },

  onDestroy() {
    deleteAll(this.state.iconWidgets)
    getApp()._options.globalData.homePageRefresh = null
  }
})
