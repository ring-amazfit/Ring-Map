import { createWidget, widget } from '@zos/ui'
import { px } from '@zos/utils'

var ICONS = {
  straight: 'nav-straight.png',
  turn_left: 'nav-turn-left.png',
  turn_right: 'nav-turn-right.png',
  slight_left: 'nav-slight-left.png',
  slight_right: 'nav-slight-right.png',
  forward_left: 'nav-forward-left.png',
  forward_right: 'nav-forward-right.png',
  back_left: 'nav-back-left.png',
  back_right: 'nav-back-right.png',
  uturn_left: 'nav-uturn-left.png',
  uturn_right: 'nav-uturn-right.png',
  sharp_left: 'nav-sharp-left.png',
  sharp_right: 'nav-sharp-right.png',
  keep_left: 'nav-keep-left.png',
  keep_right: 'nav-keep-right.png',
  roundabout_enter: 'nav-roundabout-enter.png',
  roundabout_exit: 'nav-roundabout-exit.png',
  merge_left: 'nav-merge-left.png',
  merge_right: 'nav-merge-right.png',
  fork_left: 'nav-fork-left.png',
  fork_right: 'nav-fork-right.png',
  exit_left: 'nav-exit-left.png',
  exit_right: 'nav-exit-right.png',
  arrive: 'nav-arrive.png',
  reroute: 'nav-reroute.png',
  wait: 'nav-wait.png'
}

export function actionIcon(action) {
  var type = String(action || 'wait').toLowerCase().replace(/-/g, '_')
  if (ICONS[type]) return type
  if (type === 'left') return 'turn_left'
  if (type === 'right') return 'turn_right'
  if (type === 'uturn') return 'uturn_left'
  if (type === 'waiting' || type === 'pending' || type === 'none') return 'wait'
  if (type.indexOf('roundabout') >= 0 || type.indexOf('环岛') >= 0) return 'roundabout_enter'
  if (type.indexOf('uturn') >= 0 || type.indexOf('掉头') >= 0 || type.indexOf('调头') >= 0) return 'uturn_left'
  if (type.indexOf('left') >= 0 || type.indexOf('左') >= 0) return 'turn_left'
  if (type.indexOf('right') >= 0 || type.indexOf('右') >= 0) return 'turn_right'
  if (type.indexOf('arrive') >= 0 || type.indexOf('到达') >= 0 || type.indexOf('终点') >= 0) return 'arrive'
  return 'wait'
}

export function actionTitle(action) {
  switch (actionIcon(action)) {
    case 'straight': return '继续直行'
    case 'turn_left': return '向左转弯'
    case 'turn_right': return '向右转弯'
    case 'slight_left': return '稍向左转'
    case 'slight_right': return '稍向右转'
    case 'forward_left': return '驶向左前方'
    case 'forward_right': return '驶向右前方'
    case 'back_left': return '驶向左后方'
    case 'back_right': return '驶向右后方'
    case 'uturn_left': return '向左掉头'
    case 'uturn_right': return '向右掉头'
    case 'sharp_left': return '向左急转'
    case 'sharp_right': return '向右急转'
    case 'keep_left': return '保持左侧'
    case 'keep_right': return '保持右侧'
    case 'roundabout_enter': return '进入环岛'
    case 'roundabout_exit': return '驶出环岛'
    case 'merge_left': return '向左合流'
    case 'merge_right': return '向右合流'
    case 'fork_left': return '选择左侧岔路'
    case 'fork_right': return '选择右侧岔路'
    case 'exit_left': return '左侧出口驶出'
    case 'exit_right': return '右侧出口驶出'
    case 'arrive': return '已到达目的地'
    case 'reroute': return '正在重新规划'
    default: return '等待新指令'
  }
}

export function createActionIcon(action, x, y, size) {
  var type = actionIcon(action)
  var side = size || 128
  return createWidget(widget.IMG, {
    x: px(x === undefined ? 176 : x),
    y: px(y === undefined ? 100 : y),
    w: px(side), h: px(side),
    src: ICONS[type] || ICONS.wait
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
