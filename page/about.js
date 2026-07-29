import { createWidget, widget, align } from '@zos/ui'
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
  onInit() {
    applySavedScreenSetting()
  },

  build() {
    drawThemeBackground(480)
    text(90, 22, 300, 34, 30, TEXT, 'RINGMAP')
    text(100, 57, 280, 20, 12, CYAN, 'ZeppOS 3.0.1 · APP ID 1121554')
    createWidget(widget.IMG, { x: px(152), y: px(104), w: px(176), h: px(176), src: 'github-qr.png' })
    text(90, 294, 300, 24, 16, TEXT, 'GitHub 仓库')
    text(54, 320, 372, 22, 12, SUB, 'github.com/ring-amazfit/Ring-Map')
    text(70, 350, 340, 20, 12, SUB, '本地同步系统导航通知 · 不含地图服务')
    text(70, 376, 340, 20, 11, MUTED, '导航箭头：Icons8 · 其余视觉：RingMap')
    createWidget(widget.BUTTON, {
      x: px(216), y: px(416), w: px(48), h: px(40), radius: px(8), text_size: px(28),
      color: TEXT, normal_color: PANEL, press_color: PRESS,
      text: '‹', click_func: function() { back() }
    })
  },

  onDestroy() {}
})
