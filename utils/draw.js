import { createWidget, widget, deleteWidget } from '@zos/ui'
import { px } from '@zos/utils'

// RingMap 内置的 easy-draw 风格线段绘制器，只使用 FILL_RECT，不依赖 Canvas。
export function line(pointA, pointB, options) {
  var o = options || {}
  var width = o.width || 12
  var color = o.color === undefined ? 0xFFB547 : o.color
  var a = { x: pointA.x, y: pointA.y }
  var b = { x: pointB.x, y: pointB.y }
  var dx = b.x - a.x
  var dy = b.y - a.y
  var length = Math.sqrt(dx * dx + dy * dy)
  var angle = Math.atan2(dy, dx)
  var deg = (Math.round(angle * 180 / Math.PI) + 360) % 360
  var diagonal = deg % 90 !== 0
  var lineFix = o.line_fix !== false

  // FILL_RECT 旋转斜线在部分设备上会缩短，沿用 easy-draw 的修正方式。
  if (lineFix) {
    var correctionAngle = 25
    if ((dx > 0 && dy > 0 && Math.abs(deg) <= correctionAngle) ||
        (dx < 0 && dy > 0 && Math.abs(deg - 180) <= correctionAngle)) {
      length *= 1.2
      var shift = 0.2 * length
      a.x += shift * Math.cos(angle)
      a.y += shift * Math.sin(angle)
    }
  }

  if (dx < 0 && dy > 0) deg = 360 + deg
  if (dx < 0) deg += 180
  if (dy < 0) deg += 180

  var centerX = (a.x + b.x) / 2
  var centerY = (a.y + b.y) / 2
  var x
  var y

  if (dx < 0 && dy < 0) {
    x = centerX + length / 2 * Math.cos(angle)
    y = centerY + length / 2 * Math.sin(angle)
    deg += 180
  } else if (dx > 0 && dy < 0) {
    x = centerX - length / 2 * Math.cos(angle)
    y = centerY + length / 2 * Math.sin(angle)
    deg += 180
  } else if (dx < 0 && dy > 0) {
    x = centerX + length / 2 * Math.cos(angle)
    y = centerY - length / 2 * Math.sin(angle)
    deg += 180
  } else if (diagonal) {
    x = centerX - length / 2 * Math.cos(angle)
    y = centerY - length / 2 * Math.sin(angle)
  } else if (Math.abs(dx) > Math.abs(dy)) {
    x = centerX - length / 2
    y = centerY - width / 2
  } else {
    x = centerX - width / 2
    y = centerY - length / 2
  }

  return createWidget(widget.FILL_RECT, {
    x: px(x), y: px(y), w: px(length), h: px(width),
    radius: 0, angle: deg, color: color
  })
}

export function circle(cx, cy, radius, color) {
  return createWidget(widget.CIRCLE, {
    center_x: cx, center_y: cy,
    x: px(cx - radius), y: px(cy - radius),
    w: px(radius * 2), h: px(radius * 2), radius: radius,
    color: color === undefined ? 0xFFB547 : color
  })
}

export function deleteAll(items) {
  for (var i = 0; i < items.length; i++) {
    try {
      if (items[i]) deleteWidget(items[i])
    } catch (e) {}
  }
  items.length = 0
}
