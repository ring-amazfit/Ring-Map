import { createWidget, widget, align, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { push } from '@zos/router'
import { localStorage } from '@zos/storage'
import { applySavedScreenSetting } from '../utils/settings'

var W = 480
var BG = 0x050505
var CARD = 0x111111
var CARD_2 = 0x181818
var LINE = 0x303030
var TEXT = 0xF7F7F7
var SUB = 0xD1D1D1
var MUTED = 0x858585
var ACCENT = 0xFFB547
var ACCENT_2 = 0xFFD166
var KEY_TS = 'rm_nav_ts'

function text(x, y, w, h, size, color, value, alignH) {
  return createWidget(widget.TEXT, {
    x: px(x), y: px(y), w: px(w), h: px(h), text_size: px(size),
    color: color === undefined ? TEXT : color,
    align_h: alignH === undefined ? align.CENTER_H : alignH,
    align_v: align.CENTER_V, text: value || ''
  })
}

function card(y, h, color) {
  return createWidget(widget.FILL_RECT, { x: px(42), y: px(y), w: px(396), h: px(h), radius: px(24), color: color || CARD })
}

Page({
  state: { timer: null, status: null, preview: null, lastNavTs: '', routeRequested: false },

  onInit() {
    applySavedScreenSetting()
  },

  build() {
    var self = this
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: px(W), h: px(W), color: BG })
    text(72, 24, 336, 22, 13, SUB, 'RINGMAP / 主页')
    text(72, 51, 336, 36, 27, TEXT, '骑行导航')
    text(72, 89, 336, 24, 11, MUTED, '只显示当前这一步，骑行时更容易看清')

    card(125, 110, CARD)
    createWidget(widget.FILL_RECT, { x: px(84), y: px(149), w: px(6), h: px(48), radius: px(3), color: ACCENT })
    text(105, 143, 290, 20, 12, MUTED, '当前链路', align.LEFT)
    self.state.status = text(105, 169, 290, 31, 21, TEXT, '等待连接手机', align.LEFT)
    self.state.preview = text(105, 204, 290, 18, 11, MUTED, '等待手机开始导航', align.LEFT)

    card(253, 130, CARD_2)
    text(84, 274, 312, 20, 12, MUTED, '快捷操作', align.LEFT)
    createWidget(widget.BUTTON, {
      x: px(64), y: px(307), w: px(170), h: px(38), radius: px(19),
      text_size: px(15), color: TEXT, normal_color: CARD, press_color: LINE,
      text: '显示导航', click_func: function() { push({ url: 'page/navigation', anim: true }) }
    })
    createWidget(widget.BUTTON, {
      x: px(246), y: px(307), w: px(170), h: px(38), radius: px(19),
      text_size: px(15), color: TEXT, normal_color: CARD, press_color: LINE,
      text: '设置', click_func: function() { push({ url: 'page/settings', anim: true }) }
    })
    text(76, 414, 328, 20, 11, MUTED, 'AMBER ROUTE · QUICK GLANCE')

    var appData = getApp()._options.globalData
    appData.homePageRefresh = function(nav) { self.renderStatus(nav) }
    self.refreshStatus()
  },

  renderStatus(nav) {
    var status = localStorage.getItem('rm_status') || 'idle'
    var raw = nav ? JSON.stringify(nav) : localStorage.getItem('rm_nav')
    var hasNav = !!raw && status === 'navigating'
    var value = !hasNav && status === 'disconnected' ? '等待连接手机' : !hasNav ? '等待手机开始导航' : '导航预览'
    this.state.status.setProperty(prop.MORE, { text: value, color: hasNav ? ACCENT_2 : status === 'connected' ? ACCENT : MUTED })
    if (hasNav) {
      try {
        var current = nav || JSON.parse(raw)
        var source = String(current.sourceLabel || '').trim()
        if (!source) source = String(current.sourcePackage || current.packageName || '').toLowerCase().indexOf('baidu') >= 0 ? '百度地图' : '高德地图'
        this.state.preview.setProperty(prop.MORE, { text: '导航预览 · ' + source, color: ACCENT_2 })
      } catch (e) { this.state.preview.setProperty(prop.MORE, { text: '导航预览', color: ACCENT_2 }) }
    } else this.state.preview.setProperty(prop.MORE, { text: status === 'disconnected' ? '手机端未连接' : '等待导航数据', color: MUTED })
  },

  refreshStatus() {
    var raw = localStorage.getItem('rm_nav')
    var status = localStorage.getItem('rm_status') || 'idle'
    var navTs = localStorage.getItem(KEY_TS) || ''
    var hasNav = !!raw && status === 'navigating'
    if (hasNav && navTs) this.state.lastNavTs = navTs
    this.renderStatus(null)
  },

  onDestroy() {
    if (this.state.timer) clearInterval(this.state.timer)
    var appData = getApp()._options.globalData
    appData.homePageRefresh = null
  }
})
