/**
 * UI 组件工具 — 主题色、箭头渲染、进度条、圆屏安全区
 * 参考 ring-notes 的 ui.js 设计风格
 */
import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'

// 共用控件仍保留为兼容旧页面；主导航页面使用 assets/icons 中的深绿色图标。
export var THEME = {
  bg: 0x050505,
  panel: 0x111111,
  panelSoft: 0x181818,
  accent: 0xFFB547,
  accentLight: 0xFFD166,
  text: 0xF7F7F7,
  textSecondary: 0xD1D1D1,
  textMuted: 0x858585,
  danger: 0xF27C72,
  success: 0xFFB547,
  border: 0x303030
}

// 圆屏安全区：圆心(240,240) r=240
export function safeHalfWidth(y) {
  var d = y - 240
  var s = 240 * 240 - d * d
  return s > 0 ? Math.sqrt(s) : 0
}

// 背景填充
export function fillBackground(color) {
  createWidget(widget.FILL_RECT, {
    x: 0, y: 0, w: px(480), h: px(480),
    color: color || THEME.bg
  })
}

// 标题栏
export function titleBar(text) {
  createWidget(widget.TEXT, {
    x: px(100), y: px(16), w: px(280), h: px(28),
    text_size: px(22), color: THEME.text,
    align_h: align.CENTER_H, align_v: align.CENTER_V,
    text: text
  })
  createWidget(widget.FILL_RECT, {
    x: px(240 - 16), y: px(46), w: px(32), h: px(3),
    radius: px(1), color: THEME.accent
  })
}

// 历史兼容 API：导航方向图标已改由 utils/icons.js 的 PNG 资源渲染。
export function navArrow(arrow, x, y, size, color) {
  var sz = size || 120
  var cx = x || 240
  var cy = y || 170

  // 圆形背景
  createWidget(widget.FILL_RECT, {
    x: px(cx - sz / 2), y: px(cy - sz / 2),
    w: px(sz), h: px(sz),
    radius: px(sz / 2),
    color: THEME.panel
  })

  // 箭头内圈高亮
  var inner = sz - 16
  createWidget(widget.FILL_RECT, {
    x: px(cx - inner / 2), y: px(cy - inner / 2),
    w: px(inner), h: px(inner),
    radius: px(inner / 2),
    color: THEME.panelSoft
  })

  // 箭头文字
  createWidget(widget.TEXT, {
    x: px(cx - sz / 2), y: px(cy - sz / 2),
    w: px(sz), h: px(sz),
    text_size: px(sz * 0.55),
    color: color || THEME.accent,
    align_h: align.CENTER_H, align_v: align.CENTER_V,
    text: arrow || ''
  })
}

// 距离显示（大字）
export function distanceDisplay(text, y) {
  createWidget(widget.TEXT, {
    x: px(60), y: px(y || 250), w: px(360), h: px(50),
    text_size: px(40), color: THEME.text,
    align_h: align.CENTER_H, align_v: align.CENTER_V,
    text: text
  })
}

// 道路名称
export function roadName(text, y) {
  createWidget(widget.TEXT, {
    x: px(60), y: px(y || 305), w: px(360), h: px(30),
    text_size: px(20), color: THEME.textSecondary,
    align_h: align.CENTER_H, align_v: align.CENTER_V,
    text: text
  })
}

// 进度条
export function progressBar(progress, y) {
  var barW = 280
  var barX = 240 - barW / 2
  var barY = y || 420
  var barH = 6

  // 背景
  createWidget(widget.FILL_RECT, {
    x: px(barX), y: px(barY), w: px(barW), h: px(barH),
    radius: px(barH / 2), color: THEME.border
  })

  // 前景
  var fillW = Math.round(barW * progress)
  if (fillW < 4) fillW = 4
  createWidget(widget.FILL_RECT, {
    x: px(barX), y: px(barY), w: px(fillW), h: px(barH),
    radius: px(barH / 2), color: THEME.accent
  })
}

// 底部信息行（剩余距离 | ETA）
export function bottomInfo(leftText, rightText) {
  createWidget(widget.TEXT, {
    x: px(40), y: px(436), w: px(180), h: px(24),
    text_size: px(14), color: THEME.textSecondary,
    align_h: align.LEFT, align_v: align.CENTER_V,
    text: leftText
  })
  createWidget(widget.TEXT, {
    x: px(260), y: px(436), w: px(180), h: px(24),
    text_size: px(14), color: THEME.textSecondary,
    align_h: align.RIGHT, align_v: align.CENTER_V,
    text: rightText
  })
}

// 顶部步骤指示（当前步/总步数）
export function stepIndicator(current, total) {
  createWidget(widget.TEXT, {
    x: px(40), y: px(16), w: px(120), h: px(24),
    text_size: px(14), color: THEME.textMuted,
    align_h: align.LEFT, align_v: align.CENTER_V,
    text: current + '/' + total
  })
}

// 按钮
export function button(opts) {
  var x = opts.x || 80
  var y = opts.y || 200
  var w = opts.w || 160
  var h = opts.h || 44
  var text = opts.text || ''
  var kind = opts.kind || 'accent'
  var bg = kind === 'accent' ? THEME.accent : THEME.panel
  var fg = kind === 'accent' ? 0x062611 : THEME.text

  var wgt = createWidget(widget.BUTTON, {
    x: px(x), y: px(y), w: px(w), h: px(h),
    text_size: px(16), color: fg,
    radius: px(h / 2),
    normal_color: bg,
    press_color: THEME.panelSoft,
    text: text,
    click_func: opts.onClick || function() {}
  })
  return wgt
}

// 状态文字（居中显示提示信息）
export function statusText(text, y) {
  createWidget(widget.TEXT, {
    x: px(60), y: px(y || 220), w: px(360), h: px(40),
    text_size: px(16), color: THEME.textSecondary,
    align_h: align.CENTER_H, align_v: align.CENTER_V,
    text: text
  })
}
