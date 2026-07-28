import { createWidget, widget } from '@zos/ui'
import { px } from '@zos/utils'

var ICONS = {
  straight: 'icon-up.png',
  left: 'icon-left.png',
  right: 'icon-right.png',
  uturn: 'icon-uturn.png',
  arrive: 'icon-arrive.png'
}

export function actionIcon(action) {
  var type = String(action || 'waiting').toLowerCase()
  if (type === 'waiting' || type === 'pending' || type === 'none') return 'waiting'
  if (type.indexOf('uturn') >= 0 || type.indexOf('掉头') >= 0 || type.indexOf('调头') >= 0) return 'uturn'
  if (type.indexOf('slight_left') >= 0 || type.indexOf('稍向左') >= 0 || type.indexOf('靠左') >= 0) return 'left'
  if (type.indexOf('left') >= 0 || type.indexOf('左') >= 0) return 'left'
  if (type.indexOf('slight_right') >= 0 || type.indexOf('稍向右') >= 0 || type.indexOf('靠右') >= 0) return 'right'
  if (type.indexOf('right') >= 0 || type.indexOf('右') >= 0) return 'right'
  return 'straight'
}

export function createActionIcon(action, x, y, size) {
  var type = actionIcon(action)
  if (type === 'waiting') return null
  var side = size || 160
  return createWidget(widget.IMG, {
    x: px(x === undefined ? 160 : x),
    y: px(y === undefined ? 78 : y),
    w: px(side), h: px(side),
    src: ICONS[type]
  })
}

export function deleteAll(items) {
  for (var i = 0; i < items.length; i++) {
    try {
      if (items[i] && items[i].deleteWidget) items[i].deleteWidget()
    } catch (e) {}
  }
  items.length = 0
}
