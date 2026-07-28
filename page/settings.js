import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { push, back } from '@zos/router'
import { localStorage } from '@zos/storage'
import { isKeepScreenEnabled, setKeepScreenEnabled, isAutoOpenEnabled, setAutoOpenEnabled, isVibrateEnabled, setVibrateEnabled, isBigTextEnabled, setBigTextEnabled, isShowSourceEnabled, setShowSourceEnabled, isStayHomeEnabled, setStayHomeEnabled, clearNavigationCache, applySavedScreenSetting } from '../utils/settings'

var BG = 0x050505
var CARD = 0x111111
var CARD_2 = 0x181818
var LINE = 0x303030
var TEXT = 0xF7F7F7
var SUB = 0xD1D1D1
var MUTED = 0x858585
var ACCENT = 0xFFB547
var ACCENT_2 = 0xFFD166

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size), color: color,
    align_h: alignH || align.CENTER_H, align_v: align.CENTER_V, text: value || ''
  })
}

function card(y, h, color) {
  return createWidget(widget.FILL_RECT, { x: px(58), y: px(y), w: px(364), h: px(h), radius: px(24), color: color || CARD })
}

Page({
  state: { keepScreen: false, autoOpen: true, vibrate: true, bigText: false, showSource: true, stayHome: true, toggle: null, status: null },

  onInit() {
    this.state.keepScreen = isKeepScreenEnabled()
    this.state.autoOpen = isAutoOpenEnabled()
    this.state.vibrate = isVibrateEnabled()
    this.state.bigText = isBigTextEnabled()
    this.state.showSource = isShowSourceEnabled()
    this.state.stayHome = isStayHomeEnabled()
    applySavedScreenSetting()
  },

  build() {
    var self = this
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: px(480), h: px(480), color: BG })
    text(72, 24, 336, 22, 13, SUB, 'RINGMAP / 设置')
    text(72, 51, 336, 36, 27, TEXT, '偏好设置')
    text(72, 89, 336, 24, 11, MUTED, '让导航在骑行中保持清晰和可靠')

    card(127, 108, CARD)
    createWidget(widget.FILL_RECT, { x: px(84), y: px(153), w: px(6), h: px(48), radius: px(3), color: ACCENT })
    text(105, 145, 190, 24, 19, TEXT, '持续亮屏', align.LEFT)
    text(105, 174, 190, 20, 11, SUB, '导航时保持页面不自动熄灭', align.LEFT)
    self.state.toggle = createWidget(widget.BUTTON, {
      x: px(304), y: px(160), w: px(94), h: px(36), radius: px(18), text_size: px(14),
      color: TEXT, normal_color: CARD_2, press_color: LINE,
      text: self.state.keepScreen ? '已开启' : '已关闭', click_func: function() {
        self.state.keepScreen = !self.state.keepScreen
        setKeepScreenEnabled(self.state.keepScreen)
        self.state.toggle.setProperty(prop.MORE, { text: self.state.keepScreen ? '已开启' : '已关闭' })
      }
    })

    card(253, 145, CARD_2)
    text(84, 275, 312, 22, 12, MUTED, '导航偏好', align.LEFT)
    text(84, 302, 220, 20, 14, TEXT, '自动进入导航', align.LEFT)
    self.state.autoOpenToggle = createWidget(widget.BUTTON, { x: px(304), y: px(296), w: px(94), h: px(30), radius: px(15), text_size: px(12), color: TEXT, normal_color: CARD, press_color: LINE, text: self.state.autoOpen ? '已开启' : '已关闭', click_func: function() { self.state.autoOpen = !self.state.autoOpen; setAutoOpenEnabled(self.state.autoOpen); self.state.autoOpenToggle.setProperty(prop.MORE, { text: self.state.autoOpen ? '已开启' : '已关闭' }) } })
    text(84, 332, 220, 20, 14, TEXT, '骑行大字', align.LEFT)
    self.state.bigTextToggle = createWidget(widget.BUTTON, { x: px(304), y: px(326), w: px(94), h: px(30), radius: px(15), text_size: px(12), color: TEXT, normal_color: CARD, press_color: LINE, text: self.state.bigText ? '已开启' : '已关闭', click_func: function() { self.state.bigText = !self.state.bigText; setBigTextEnabled(self.state.bigText); self.state.bigTextToggle.setProperty(prop.MORE, { text: self.state.bigText ? '已开启' : '已关闭' }) } })
    text(84, 362, 220, 20, 14, TEXT, '导航震动', align.LEFT)
    self.state.vibrateToggle = createWidget(widget.BUTTON, { x: px(304), y: px(356), w: px(94), h: px(30), radius: px(15), text_size: px(12), color: TEXT, normal_color: CARD, press_color: LINE, text: self.state.vibrate ? '已开启' : '已关闭', click_func: function() { self.state.vibrate = !self.state.vibrate; setVibrateEnabled(self.state.vibrate); self.state.vibrateToggle.setProperty(prop.MORE, { text: self.state.vibrate ? '已开启' : '已关闭' }) } })

    text(84, 405, 312, 18, 12, MUTED, '当前连接', align.LEFT)
    self.state.status = text(84, 425, 312, 24, 16, TEXT, '等待连接', align.LEFT)
    var status = localStorage.getItem('rm_status') || 'idle'
    self.state.status.setProperty(prop.MORE, { text: status === 'navigating' ? '导航数据同步中' : status === 'connected' ? '手表已连接，等待确认' : '等待手机端连接' })

    createWidget(widget.BUTTON, { x: px(84), y: px(453), w: px(144), h: px(30), radius: px(15), text_size: px(13), color: TEXT, normal_color: CARD, press_color: LINE, text: '清除缓存', click_func: function() { clearNavigationCache(); self.state.status.setProperty(prop.MORE, { text: '旧导航已清除' }) } })
    createWidget(widget.BUTTON, { x: px(252), y: px(453), w: px(144), h: px(30), radius: px(15), text_size: px(13), color: TEXT, normal_color: CARD, press_color: LINE, text: '返回主页', click_func: function() { back() } })
  },

  onDestroy() {}
})
