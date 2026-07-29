import { createWidget, widget, align, prop, deleteWidget } from '@zos/ui'
import { px } from '@zos/utils'
import { push } from '@zos/router'
import { applySavedScreenSetting, isKeepScreenEnabled, setKeepScreenEnabled,
  isAutoOpenEnabled, setAutoOpenEnabled, isBigTextEnabled, setBigTextEnabled,
  getHapticMode, setHapticMode, isShowSourceEnabled, setShowSourceEnabled } from '../utils/settings'
import { drawThemeBackground } from '../utils/theme'

var TEXT = 0xF6FAF8
var SUB = 0xB5C2C8
var MUTED = 0x6F7C83
var CYAN = 0x2EDCF2
var PANEL = 0x080C0E
var ROW = 0x11191C
var ON = 0x1C6A72
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

function toggleWidget(x, y, enabled, onChange) {
  return createWidget(widget.SLIDE_SWITCH, {
    x: px(x), y: px(y), w: px(54), h: px(34),
    select_bg: 'switch-on.png', un_select_bg: 'switch-off.png',
    slide_src: 'switch-thumb.png', slide_select_x: px(25),
    slide_un_select_x: px(5), checked: !!enabled,
    checked_change_func: function(control, checked) { onChange(!!checked) }
  })
}

function clearWidgets(items) {
  for (var i = 0; i < items.length; i++) {
    try {
      if (items[i]) deleteWidget(items[i])
    } catch (e) {}
  }
  items.length = 0
}

function renderHapticControls(page) {
  clearWidgets(page.state.hapticButtons)
  var modes = [
    { value: 'off', label: '关闭' },
    { value: 'turn', label: '转向' },
    { value: 'proximity', label: '临近' }
  ]
  for (var i = 0; i < modes.length; i++) {
    (function(item, index) {
      page.state.hapticButtons.push(createWidget(widget.BUTTON, {
        x: px(246 + index * 56), y: px(247), w: px(50), h: px(34),
        radius: px(8), text_size: px(12), color: TEXT,
        normal_color: item.value === page.state.hapticMode ? ON : ROW,
        press_color: PRESS, text: item.label,
        click_func: function() {
          if (item.value === page.state.hapticMode) return
          page.state.hapticMode = item.value
          setHapticMode(item.value)
          renderHapticControls(page)
        }
      }))
    })(modes[i], i)
  }
}

Page({
  state: {
    keepScreen: false, autoOpen: true, bigText: false, hapticMode: 'turn', showSource: true,
    keepToggle: null, autoToggle: null, bigToggle: null, hapticButtons: [],
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
    drawThemeBackground(480)
    text(100, 20, 280, 30, 24, TEXT, '骑行设置')
    text(100, 48, 280, 18, 11, MUTED, '显示与提醒')
    createWidget(widget.FILL_RECT, { x: px(56), y: px(70), w: px(368), h: px(292), radius: px(8), color: PANEL })

    text(82, 82, 210, 34, 17, TEXT, '持续亮屏', align.LEFT)
    self.state.keepToggle = toggleWidget(332, 82, self.state.keepScreen, function(checked) {
      self.state.keepScreen = checked
      setKeepScreenEnabled(checked)
    })
    divider(128)

    text(82, 137, 210, 34, 17, TEXT, '自动进入导航', align.LEFT)
    self.state.autoToggle = toggleWidget(332, 137, self.state.autoOpen, function(checked) {
      self.state.autoOpen = checked
      setAutoOpenEnabled(checked)
    })
    divider(183)

    text(82, 192, 210, 34, 17, TEXT, '骑行大字', align.LEFT)
    self.state.bigToggle = toggleWidget(332, 192, self.state.bigText, function(checked) {
      self.state.bigText = checked
      setBigTextEnabled(checked)
    })
    divider(238)

    text(82, 247, 190, 34, 17, TEXT, '振动提醒', align.LEFT)
    renderHapticControls(self)
    divider(293)

    text(82, 302, 210, 34, 17, TEXT, '显示地图来源', align.LEFT)
    self.state.sourceToggle = toggleWidget(332, 302, self.state.showSource, function(checked) {
      self.state.showSource = checked
      setShowSourceEnabled(checked)
    })

    self.state.status = text(84, 366, 312, 24, 12, SUB, '正在检查连接')
    createWidget(widget.BUTTON, {
      x: px(82), y: px(402), w: px(140), h: px(42), radius: px(8), text_size: px(14),
      color: TEXT, normal_color: PANEL, press_color: PRESS, text: '主题背景',
      click_func: function() { push({ url: 'page/theme', anim: true }) }
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
