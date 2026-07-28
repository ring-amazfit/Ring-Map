import { createWidget, widget, align } from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import { applySavedScreenSetting } from '../utils/settings'

var BG = 0x050505
var CARD = 0x111111
var LINE = 0x303030
var TEXT = 0xF7F7F7
var SUB = 0xD1D1D1
var MUTED = 0x858585
var ACCENT = 0xFFB547

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size), color: color,
    align_h: alignH || align.CENTER_H, align_v: align.CENTER_V, text: value || ''
  })
}

Page({
  onInit() { applySavedScreenSetting() },

  build() {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: px(480), h: px(480), color: BG })
    text(72, 24, 336, 22, 13, SUB, 'RINGMAP / 关于')
    text(72, 51, 336, 36, 27, TEXT, '环间导航')
    text(72, 89, 336, 24, 11, MUTED, '手机通知 → 手表显示')

    createWidget(widget.FILL_RECT, { x: px(58), y: px(127), w: px(364), h: px(168), radius: px(24), color: CARD })
    createWidget(widget.FILL_RECT, { x: px(86), y: px(150), w: px(308), h: px(5), radius: px(3), color: ACCENT })
    text(78, 174, 324, 48, 32, TEXT, 'RingMap')
    createWidget(widget.FILL_RECT, { x: px(88), y: px(231), w: px(304), h: px(1), color: LINE })
    text(78, 244, 324, 22, 13, SUB, '手表端 2.4.1 · APPID 1121554')
    text(78, 268, 324, 20, 11, MUTED, '圆屏安全区 · 快速查看')

    createWidget(widget.BUTTON, { x: px(142), y: px(350), w: px(196), h: px(36), radius: px(18), text_size: px(14), color: TEXT, normal_color: CARD, press_color: LINE, text: '返回设置', click_func: function() { back() } })
    text(76, 419, 328, 20, 11, MUTED, '只在手机和手表之间同步')
  },
  onDestroy() {}
})
