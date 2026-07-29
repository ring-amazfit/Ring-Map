import { createWidget, widget, align, prop, deleteWidget } from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import { applySavedScreenSetting } from '../utils/settings'
import { getWatchTheme, setWatchTheme, watchThemeLabel } from '../utils/theme'

var TEXT = 0xF6FAF8
var SUB = 0xB5C2C8
var MUTED = 0x6F7C83
var CYAN = 0x2EDCF2
var PANEL = 0x0A1013
var ACTIVE = 0x17535B
var PRESS = 0x26343A

function text(x, y, w, h, size, color, value) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size), color: color,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text: value || ''
  })
}

Page({
  state: { selected: 'corridor', status: null, buttons: {} },

  onInit() {
    this.state.selected = getWatchTheme()
    applySavedScreenSetting()
  },

  build() {
    var self = this
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: px(480), h: px(480), color: 0x000000 })
    text(90, 24, 300, 34, 26, TEXT, '主题背景')
    text(80, 60, 320, 22, 12, MUTED, '选择后立即保存')

    self.renderThemeButtons()
    text(90, 152, 300, 18, 10, SUB, '原创夜骑路廊')
    text(90, 230, 300, 18, 10, SUB, '最低功耗与最高对比')
    text(90, 308, 300, 18, 10, SUB, '圆形角色图 · 低透明度')

    self.state.status = text(86, 350, 308, 24, 13, CYAN,
      '当前：' + watchThemeLabel(self.state.selected))
    createWidget(widget.BUTTON, {
      x: px(196), y: px(400), w: px(88), h: px(44), radius: px(8), text_size: px(15),
      color: TEXT, normal_color: PANEL, press_color: PRESS,
      text: '完成', click_func: function() { back() }
    })
  },

  renderThemeButtons() {
    var self = this
    Object.keys(self.state.buttons).forEach(function(value) {
      var current = self.state.buttons[value]
      try { if (current) deleteWidget(current) } catch (e) {}
    })
    self.state.buttons = {}

    var items = [
      { value: 'corridor', title: '夜骑道路', y: 104 },
      { value: 'black', title: '纯黑', y: 182 },
      { value: 'anime', title: '导航娘', y: 260 }
    ]
    for (var i = 0; i < items.length; i++) {
      (function(item) {
        self.state.buttons[item.value] = createWidget(widget.BUTTON, {
          x: px(68), y: px(item.y), w: px(344), h: px(46), radius: px(8), text_size: px(17),
          color: TEXT, normal_color: self.state.selected === item.value ? ACTIVE : PANEL,
          press_color: PRESS, text: item.title,
          click_func: function() {
            if (self.state.selected === item.value) return
            self.state.selected = setWatchTheme(item.value)
            self.renderThemeButtons()
            self.state.status.setProperty(prop.MORE, {
              text: '已选择：' + watchThemeLabel(item.value), color: CYAN
            })
          }
        })
      })(items[i])
    }
  }
})
