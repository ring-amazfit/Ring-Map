import { createWidget, widget } from '@zos/ui'
import { px } from '@zos/utils'
import { localStorage } from '@zos/storage'

var KEY_THEME = 'rm_watch_theme'
var THEMES = ['corridor', 'black', 'anime']

export function getWatchTheme() {
  var value = localStorage.getItem(KEY_THEME)
  return THEMES.indexOf(value) >= 0 ? value : 'corridor'
}

export function setWatchTheme(value) {
  var theme = THEMES.indexOf(value) >= 0 ? value : 'corridor'
  localStorage.setItem(KEY_THEME, theme)
  return theme
}

export function watchThemeLabel(value) {
  var theme = value || getWatchTheme()
  if (theme === 'black') return '纯黑'
  if (theme === 'anime') return '导航娘'
  return '夜骑道路'
}

export function drawThemeBackground(width) {
  var side = width || 480
  var theme = getWatchTheme()
  createWidget(widget.FILL_RECT, {
    x: 0, y: 0, w: px(side), h: px(side), color: 0x000000
  })
  if (theme === 'corridor') {
    createWidget(widget.IMG, {
      x: 0, y: 0, w: px(side), h: px(side), src: 'night-corridor-bg.png'
    })
  } else if (theme === 'anime') {
    createWidget(widget.IMG, {
      x: 0, y: 0, w: px(side), h: px(side), src: 'anime-background.png'
    })
  }
  return theme
}
