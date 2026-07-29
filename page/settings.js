import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { push } from '@zos/router'
import { applySavedScreenSetting, isKeepScreenEnabled, setKeepScreenEnabled,
  isAutoOpenEnabled, setAutoOpenEnabled, isBigTextEnabled, setBigTextEnabled,
  getHapticMode, setHapticMode, isShowSourceEnabled, setShowSourceEnabled } from '../utils/settings'

var TEXT = 0xF6FAF8
var SUB = 0xB5C2C8
var MUTED = 0x6F7C83
var CYAN = 0x2EDCF2
var PANEL = 0x080C0E
var ROW = 0x11191C
var ON = 0x1C6A72
var OFF = 0x20282B
var PRESS = 0x26343A

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size), color: color,
    align_h: alignH || align.CENTER_H, align_v: align.CENTER_V, text: value || ''
  })
}

function divider(y) {
  createWidget(widget.FILL_RECT, { x: px(78), y: px(y), w: px(324), h: px(1), color: 0x243036 })
}

function toggleWidget(x, y, enabled, onClick) {
  return createWidget(widget.BUTTON, {
    x: px(x), y: px(y), w: px(46), h: px(34), radius: px(8), text_size: px(17),
    color: TEXT, normal_color: enabled ? ON : OFF, press_color: PRESS,
    text: enabled ? '✓' : '—', click_func: onClick
  })
}

function setToggle(widgetRef, enabled) {
  widgetRef.setProperty(prop.MORE, {
    text: enabled ? '✓' : '—', normal_color: enabled ? ON : OFF
  })
}

function hapticLabel(mode) {
  if (mode === 'off') return '关闭'
  if (mode === 'proximity') return '临近'
  return '转向'
}

Page({
  state: {
    keepScreen: false, autoOpen: true, bigText: false, hapticMode: 'turn', showSource: true,
    keepToggle: null, autoToggle: null, bigToggle: null, hapticToggle: null,
    sourceToggle: null, status: null
  },

  onInit() {
    this.state.keepScreen = isKeepScreenEnabled()
    this.state.autoOpen = isAutoOpenEnabled()
    this.state.bigText = isBigTextEnabled()
    this.state.hapticMode = getHapticMode()
    this.state.showSource = isShowSourceEnabled()
    applySavedScreenSetting()
  },

  build() {
    var self = this
    createWidget(widget.IMG, { x: 0, y: 0, w: px(480), h: px(480), src: 'night-corridor-bg.png' })
    text(100, 20, 280, 30, 24, TEXT, '骑行设置')
    text(100, 48, 280, 18, 11, MUTED, '显示与提醒')
    createWidget(widget.FILL_RECT, { x: px(56), y: px(70), w: px(368), h: px(292), radius: px(8), color: PANEL })

    text(82, 82, 210, 34, 17, TEXT, '持续亮屏', align.LEFT)
    self.state.keepToggle = toggleWidget(340, 82, self.state.keepScreen, function() {
      self.state.keepScreen = !self.state.keepScreen
      setKeepScreenEnabled(self.state.keepScreen)
      setToggle(self.state.keepToggle, self.state.keepScreen)
    })
    divider(128)

    text(82, 137, 210, 34, 17, TEXT, '自动进入导航', align.LEFT)
    self.state.autoToggle = toggleWidget(340, 137, self.state.autoOpen, function() {
      self.state.autoOpen = !self.state.autoOpen
      setAutoOpenEnabled(self.state.autoOpen)
      setToggle(self.state.autoToggle, self.state.autoOpen)
    })
    divider(183)

    text(82, 192, 210, 34, 17, TEXT, '骑行大字', align.LEFT)
    self.state.bigToggle = toggleWidget(340, 192, self.state.bigText, function() {
      self.state.bigText = !self.state.bigText
      setBigTextEnabled(self.state.bigText)
      setToggle(self.state.bigToggle, self.state.bigText)
    })
    divider(238)

    text(82, 247, 190, 34, 17, TEXT, '振动提醒', align.LEFT)
    self.state.hapticToggle = createWidget(widget.BUTTON, {
      x: px(308), y: px(247), w: px(78), h: px(34), radius: px(8), text_size: px(13),
      color: TEXT, normal_color: ROW, press_color: PRESS, text: hapticLabel(self.state.hapticMode),
      click_func: function() {
        self.state.hapticMode = self.state.hapticMode === 'off' ? 'turn'
          : self.state.hapticMode === 'turn' ? 'proximity' : 'off'
        setHapticMode(self.state.hapticMode)
        self.state.hapticToggle.setProperty(prop.MORE, { text: hapticLabel(self.state.hapticMode) })
      }
    })
    divider(293)

    text(82, 302, 210, 34, 17, TEXT, '显示地图来源', align.LEFT)
    self.state.sourceToggle = toggleWidget(340, 302, self.state.showSource, function() {
      self.state.showSource = !self.state.showSource
      setShowSourceEnabled(self.state.showSource)
      setToggle(self.state.sourceToggle, self.state.showSource)
    })

    self.state.status = text(84, 366, 312, 24, 12, SUB, '正在检查连接')
    createWidget(widget.BUTTON, {
      x: px(82), y: px(402), w: px(140), h: px(42), radius: px(8), text_size: px(14),
      color: TEXT, normal_color: PANEL, press_color: PRESS, text: '重新同步',
      click_func: function() {
        var appData = getApp()._options.globalData
        if (typeof appData.requestLatestNav === 'function') appData.requestLatestNav()
        self.state.status.setProperty(prop.MORE, { text: '已请求最新导航', color: CYAN })
      }
    })
    createWidget(widget.BUTTON, {
      x: px(258), y: px(402), w: px(140), h: px(42), radius: px(8), text_size: px(14),
      color: TEXT, normal_color: PANEL, press_color: PRESS, text: '关于',
      click_func: function() { push({ url: 'page/about', anim: true }) }
    })

    var navState = getApp()._options.globalData.navState
    var connected = navState && navState.bridgeStatus === 'connected'
    self.state.status.setProperty(prop.MORE, {
      text: connected ? '手机导航桥在线' : '等待手机导航桥', color: connected ? CYAN : MUTED
    })
  },

  onDestroy() {}
})
