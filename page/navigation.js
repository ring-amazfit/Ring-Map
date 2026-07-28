import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { localStorage } from '@zos/storage'
import { vibrate } from '@zos/interaction'
import { applySavedScreenSetting, isVibrateEnabled, isBigTextEnabled, isShowSourceEnabled } from '../utils/settings'
import { createActionIcon, deleteAll } from '../utils/icons'

var BG = 0x050505
var TEXT = 0xF7F7F7
var SUB = 0xD1D1D1
var MUTED = 0x858585
var TRACK = 0x292929
var TURN = 0xFFB547
var LIVE = 0xFFD166
var W = 480
var ARROW_X = 150
var ARROW_Y = 88
var ARROW_SIZE = 180
var DISTANCE_Y = 276
var INSTRUCTION_Y = 348
var ROAD_Y = 382
var PROGRESS_Y = 416
var KEY_NAV = 'rm_nav'
var KEY_STATUS = 'rm_status'

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size),
    color: color === undefined ? TEXT : color,
    align_h: alignH === undefined ? align.CENTER_H : alignH,
    align_v: align.CENTER_V, text: value || ''
  })
}

function normalizedAction(action) {
  var type = String(action || 'straight').toLowerCase()
  if (type.indexOf('arrive') >= 0 || type.indexOf('到达') >= 0 || type.indexOf('终点') >= 0) return 'arrive'
  if (type.indexOf('uturn') >= 0 || type.indexOf('掉头') >= 0 || type.indexOf('调头') >= 0) return 'uturn'
  if (type.indexOf('slight_left') >= 0 || type.indexOf('稍向左') >= 0 || type.indexOf('靠左') >= 0) return 'slight_left'
  if (type.indexOf('slight_right') >= 0 || type.indexOf('稍向右') >= 0 || type.indexOf('靠右') >= 0) return 'slight_right'
  if (type.indexOf('left') >= 0 || type.indexOf('左') >= 0) return 'left'
  if (type.indexOf('right') >= 0 || type.indexOf('右') >= 0) return 'right'
  return 'straight'
}

function actionTitle(action) {
  switch (normalizedAction(action)) {
    case 'left': return '左转'
    case 'right': return '右转'
    case 'slight_left': return '向左前方'
    case 'slight_right': return '向右前方'
    case 'uturn': return '掉头'
    case 'arrive': return '到达终点'
    default: return '继续直行'
  }
}

function distance(nav) {
  if (nav.distanceText) return String(nav.distanceText)
  if (nav.distance == null) return '—'
  return nav.distance < 1000 ? Math.round(nav.distance) + '米' : (nav.distance / 1000).toFixed(1) + '公里'
}

function clipped(value, count) {
  var result = String(value || '')
  return result.length > count ? result.substring(0, count) : result
}

Page({
  state: { timer: null, recoveryTicks: 0, arrowWidgets: [], lastAction: 'waiting', status: null, action: null, distance: null, instruction: null, road: null, progress: null, lastKey: '', session: 0 },

  onInit() {
    applySavedScreenSetting()
  },

  build() {
    var self = this
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: px(W), h: px(W), color: BG })
    self.state.status = text(80, 20, 320, 24, 14, LIVE, '等待手机导航', align.CENTER_H)
    text(86, 54, 308, 24, 16, SUB, '下一步')
    self.state.action = text(72, 58, 336, 28, 21, TEXT, '等待导航')
    self.state.distance = text(60, DISTANCE_Y, 360, 68, isBigTextEnabled() ? 68 : 62, TEXT, '—')
    self.state.instruction = text(48, INSTRUCTION_Y, 384, 30, isBigTextEnabled() ? 23 : 21, SUB, '', align.CENTER_H)
    self.state.road = text(48, ROAD_Y, 384, 24, 16, MUTED, '', align.CENTER_H)
    createWidget(widget.FILL_RECT, { x: px(80), y: px(PROGRESS_Y), w: px(320), h: px(8), radius: px(4), color: TRACK })
    self.state.progress = createWidget(widget.FILL_RECT, { x: px(80), y: px(PROGRESS_Y), w: px(4), h: px(8), radius: px(4), color: LIVE })
    text(70, 442, 340, 18, 12, MUTED, '导航数据自动更新')

    var appData = getApp()._options.globalData
    appData.navPageActive = true
    appData.navRoutePending = false
    appData.navPageRefresh = function(nav) { self.renderNav(nav) }
    if (typeof appData.requestLatestNav === 'function') appData.requestLatestNav()
    self.refreshFromCache()
  },

  refreshFromCache() {
    var raw = localStorage.getItem(KEY_NAV)
    var status = localStorage.getItem(KEY_STATUS) || 'idle'
    if (!raw || status !== 'navigating') {
      this.renderNav(null, status)
      return
    }
    try {
      this.renderNav(JSON.parse(raw), status)
    } catch (e) {
      this.renderNav(null, status)
    }
  },

  renderArrow(action) {
    var type = action ? normalizedAction(action) : 'waiting'
    if (type === this.state.lastAction) return
    this.state.lastAction = type
    deleteAll(this.state.arrowWidgets)
    if (type !== 'waiting') {
      var icon = createActionIcon(type, ARROW_X, ARROW_Y, ARROW_SIZE)
      if (icon) this.state.arrowWidgets.push(icon)
    }
  },

  renderNav(nav, status) {
    if (!nav) {
      this.state.status.setProperty(prop.MORE, { text: status === 'connected' ? '等待手机导航数据' : '等待手机连接', color: status === 'connected' ? LIVE : MUTED })
      this.state.action.setProperty(prop.MORE, { text: '等待导航', color: SUB })
      this.state.distance.setProperty(prop.MORE, { text: '—' })
      this.state.instruction.setProperty(prop.MORE, { text: status === 'connected' ? '开始导航后会自动显示' : '正在连接手机端', color: SUB })
      this.state.road.setProperty(prop.MORE, { text: '' })
      this.state.progress.setProperty(prop.MORE, { w: px(4), color: LIVE })
      this.renderArrow(null)
      return
    }

    this.state.session = Number(nav.session || 0)
    var action = normalizedAction(nav.action)
    var key = String(nav.ts || '') + '|' + action + '|' + String(nav.distance || nav.distanceText || '')
    this.state.status.setProperty(prop.MORE, { text: '实时导航', color: LIVE })
    this.state.action.setProperty(prop.MORE, { text: actionTitle(action), color: TEXT })
    this.state.distance.setProperty(prop.MORE, { text: distance(nav), color: TEXT })
    this.state.instruction.setProperty(prop.MORE, { text: clipped(nav.instruction || actionTitle(action), 15), color: SUB })
    var roadText = nav.road ? '进入 ' + clipped(nav.road, 15) : ''
    if (isShowSourceEnabled() && nav.sourceLabel) roadText += roadText ? ' · ' + nav.sourceLabel : nav.sourceLabel
    this.state.road.setProperty(prop.MORE, { text: roadText, color: MUTED })
    this.renderArrow(action)
    if (nav.progress != null) {
      var progress = Number(nav.progress)
      if (progress <= 1) progress *= 100
      var width = Math.max(4, Math.min(320, Math.round(320 * progress / 100)))
      this.state.progress.setProperty(prop.MORE, { w: px(width), color: LIVE })
    }
    if (isVibrateEnabled() && this.state.lastKey && this.state.lastKey !== key) vibrate({ duration: 180 })
    this.state.lastKey = key
  },

  onDestroy() {
    if (this.state.timer) clearInterval(this.state.timer)
    deleteAll(this.state.arrowWidgets)
    var appData = getApp()._options.globalData
    appData.navPageActive = false
    appData.navPageRefresh = null
  }
})
