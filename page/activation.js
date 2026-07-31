import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import { applySavedScreenSetting } from '../utils/settings'
import { drawThemeBackground } from '../utils/theme'

var TEXT = 0xF6FAF8
var SUB = 0xB5C2C8
var MUTED = 0x6F7C83
var CYAN = 0x2EDCF2
var PANEL = 0x080C0E
var PRESS = 0x182329

function text(x, y, w, h, size, color, value) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size), color: color,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text: value || ''
  })
}

Page({
  state: { status: null, checkButton: null },

  onInit() {
    applySavedScreenSetting()
  },

  build() {
    var self = this
    drawThemeBackground(480)
    text(64, 24, 352, 34, 26, TEXT, '连接手机后激活')
    text(74, 60, 332, 22, 12, SUB, '请先安装 Android 配套端，再通过 Zepp 连接手表')
    createWidget(widget.IMG, {
      x: px(152), y: px(94), w: px(176), h: px(176), src: 'download-qr.png'
    })
    text(54, 283, 372, 42, 15, TEXT, '扫码下载 RingMap Android 配套端')
    self.state.status = text(64, 330, 352, 40, 13, MUTED, '等待 Android 导航桥连接')
    self.state.checkButton = createWidget(widget.BUTTON, {
      x: px(114), y: px(394), w: px(252), h: px(44), radius: px(8), text_size: px(15),
      color: TEXT, normal_color: PANEL, press_color: PRESS, text: '我已连接，重新检查',
      click_func: function() {
        var appData = getApp()._options.globalData
        if (appData.watchActivated) {
          back()
          return
        }
        if (typeof appData.requestLatestNav === 'function') appData.requestLatestNav()
        self.renderStatus(false)
      }
    })
    var appData = getApp()._options.globalData
    appData.activationPageRefresh = function(active) { self.renderStatus(active) }
    self.renderStatus(!!appData.watchActivated)
    if (typeof appData.requestLatestNav === 'function') appData.requestLatestNav()
  },

  renderStatus(activated) {
    if (activated) {
      this.state.status.setProperty(prop.MORE, {
        text: '已激活，可返回首页开始导航', color: CYAN
      })
      this.state.checkButton.setProperty(prop.MORE, { text: '返回首页' })
      return
    }
    this.state.status.setProperty(prop.MORE, {
      text: '保持 Zepp 与手表连接，激活会自动完成', color: MUTED
    })
    this.state.checkButton.setProperty(prop.MORE, { text: '我已连接，重新检查' })
  },

  onDestroy() {
    getApp()._options.globalData.activationPageRefresh = null
  }
})
