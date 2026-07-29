import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { localStorage } from '@zos/storage'
import { applySavedScreenSetting, isBigTextEnabled, isShowSourceEnabled } from '../utils/settings'
import { actionIcon, actionTitle, createActionIcon, deleteAll } from '../utils/icons'

var TEXT = 0xF6FAF8
var SUB = 0xB5C2C8
var MUTED = 0x6F7C83
var CYAN = 0x2EDCF2
var CORAL = 0xFF6E63
var W = 480
var ARROW_X = 176
var ARROW_Y = 100
var ARROW_SIZE = 128
var DISTANCE_Y = 246
var INSTRUCTION_Y = 340
var ROAD_Y = 378
var UPDATED_Y = 408
var KEY_NAV = 'rm_nav'

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size),
    color: color === undefined ? TEXT : color,
    align_h: alignH === undefined ? align.CENTER_H : alignH,
    align_v: align.CENTER_V, text: value || ''
  })
}

function clipped(value, count) {
  var result = String(value || '').trim()
  return result.length > count ? result.substring(0, count - 1) + '…' : result
}

function distanceText(nav) {
  if (!nav) return ''
  if (nav.distanceText) return String(nav.distanceText)
  var meters = Number(nav.distanceMeters || nav.distance || 0)
  if (!meters) return '—'
  return meters < 1000 ? Math.round(meters) + '米' : (meters / 1000).toFixed(1) + '公里'
}

function sourceText(nav) {
  if (!isShowSourceEnabled()) return '实时导航'
  return String(nav.sourceName || nav.sourceLabel || '系统导航')
}

Page({
  state: {
    arrowWidgets: [], lastAction: '', lastAppliedKey: '', status: null,
    action: null, distance: null, instruction: null, road: null, updated: null, footer: null
  },

  onInit() {
    applySavedScreenSetting()
  },

  build() {
    var self = this
    createWidget(widget.IMG, { x: 0, y: 0, w: px(W), h: px(W), src: 'night-corridor-bg.png' })
    self.state.status = text(100, 24, 280, 22, 13, CYAN, '等待手机导航')
    self.state.action = text(60, 58, 360, 34, 24, TEXT, '等待导航')
    self.state.distance = text(40, DISTANCE_Y, 400, 88,
      isBigTextEnabled() ? 80 : 72, TEXT, '')
    self.state.instruction = text(54, INSTRUCTION_Y, 372, 32,
      isBigTextEnabled() ? 23 : 21, TEXT, '')
    self.state.road = text(66, ROAD_Y, 348, 24, 15, SUB, '')
    self.state.updated = text(88, UPDATED_Y, 304, 20, 12, MUTED, '')
    self.state.footer = text(96, 434, 288, 18, 11, MUTED, '协议 v2')

    var appData = getApp()._options.globalData
    appData.navPageActive = true
    if (typeof appData.confirmNavigationPage === 'function') appData.confirmNavigationPage()
    appData.navPageRefresh = function(nav, navState) { self.renderNav(nav, navState) }
    if (typeof appData.requestLatestNav === 'function') appData.requestLatestNav()
    self.refreshCurrentState()
  },

  refreshCurrentState() {
    var appData = getApp()._options.globalData
    if (appData.navState && appData.navState.status === 'active' && appData.navState.snapshot) {
      this.renderNav(appData.navState.snapshot, appData.navState)
      return
    }
    var raw = localStorage.getItem(KEY_NAV)
    if (raw) {
      try {
        this.renderNav(JSON.parse(raw), appData.navState)
        return
      } catch (e) {}
    }
    this.renderNav(null, appData.navState)
  },

  renderArrow(action) {
    var type = actionIcon(action)
    if (type === this.state.lastAction) return
    this.state.lastAction = type
    deleteAll(this.state.arrowWidgets)
    this.state.arrowWidgets.push(createActionIcon(type, ARROW_X, ARROW_Y, ARROW_SIZE))
  },

  renderNav(nav, navState) {
    var state = navState || getApp()._options.globalData.navState || { status: 'idle', bridgeStatus: 'disconnected' }
    if (!nav || state.status !== 'active') {
      var stale = state.status === 'stale'
      var connected = state.bridgeStatus === 'connected'
      this.state.status.setProperty(prop.MORE, {
        text: stale ? '数据已过期' : connected ? '手机已连接' : '等待手机连接',
        color: stale ? CORAL : connected ? CYAN : MUTED
      })
      this.state.action.setProperty(prop.MORE, { text: stale ? '等待新指令' : '等待导航' })
      this.state.distance.setProperty(prop.MORE, { text: '' })
      this.state.instruction.setProperty(prop.MORE, {
        text: stale ? '旧方向已隐藏' : connected ? '开始手机导航后自动显示' : '正在恢复导航桥',
        color: SUB
      })
      this.state.road.setProperty(prop.MORE, { text: '' })
      this.state.updated.setProperty(prop.MORE, { text: '' })
      this.state.footer.setProperty(prop.MORE, { text: '协议 v2 · ' + (connected ? '桥接在线' : '桥接离线') })
      this.renderArrow('wait')
      return
    }

    var type = actionIcon(nav.action)
    var title = actionTitle(type)
    this.state.status.setProperty(prop.MORE, { text: sourceText(nav), color: CYAN })
    this.state.action.setProperty(prop.MORE, { text: title, color: type === 'arrive' ? CORAL : TEXT })
    this.state.distance.setProperty(prop.MORE, { text: distanceText(nav), color: TEXT })
    this.state.instruction.setProperty(prop.MORE, {
      text: clipped(nav.instruction || title, isBigTextEnabled() ? 14 : 17), color: TEXT
    })
    var road = clipped(nav.road || '', 18)
    this.state.road.setProperty(prop.MORE, { text: road, color: SUB })
    this.state.updated.setProperty(prop.MORE, {
      text: nav.quality === 'partial' ? '等待完整转向信息' : '刚刚更新', color: MUTED
    })
    this.state.footer.setProperty(prop.MORE, { text: '会话 #' + String(nav.seq || '—') + ' · 协议 v2' })
    this.renderArrow(type)

    var appliedKey = String(nav.sessionId || '') + ':' + String(nav.seq || '')
    if (appliedKey !== this.state.lastAppliedKey) {
      this.state.lastAppliedKey = appliedKey
      var appData = getApp()._options.globalData
      if (typeof appData.markApplied === 'function') appData.markApplied(nav)
    }
  },

  onDestroy() {
    deleteAll(this.state.arrowWidgets)
    var appData = getApp()._options.globalData
    appData.navPageActive = false
    appData.navPageRefresh = null
  }
})
