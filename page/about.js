import { createWidget, widget, align } from '@zos/ui'
import { px } from '@zos/utils'
import { back, push } from '@zos/router'
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
  onInit() {
    applySavedScreenSetting()
  },

  build() {
    drawThemeBackground(480)
    text(90, 22, 300, 34, 30, TEXT, 'RINGMAP')
    text(100, 57, 280, 20, 12, CYAN, 'ZeppOS 1.1.1 · APP ID 1121554')
    createWidget(widget.IMG, { x: px(152), y: px(88), w: px(152), h: px(152), src: 'github-qr.png' })
    text(90, 248, 300, 22, 15, TEXT, 'GitHub 仓库')
    text(54, 271, 372, 20, 12, SUB, 'github.com/ring-amazfit/Ring-Map')
    createWidget(widget.BUTTON, {
      x: px(88), y: px(306), w: px(304), h: px(42), radius: px(8), text_size: px(14),
      color: TEXT, normal_color: PANEL, press_color: PRESS,
      text: '重新查看 Android 下载二维码',
      click_func: function() { push({ url: 'page/activation', anim: true }) }
    })
    text(70, 362, 340, 20, 12, SUB, '本地同步系统导航通知 · 不含地图服务')
    text(70, 385, 340, 20, 11, MUTED, '导航箭头：Icons8 · 其余视觉：RingMap')
    createWidget(widget.BUTTON, {
      x: px(216), y: px(416), w: px(48), h: px(40), radius: px(8), text_size: px(28),
      color: TEXT, normal_color: PANEL, press_color: PRESS,
      text: '‹', click_func: function() { back() }
    })
  },

  onDestroy() {}
})
