/**
 * 存储工具 — 导航数据读写（简化版）
 * 手表端仅读取 app-side 写入的导航数据
 */
import { localStorage } from '@zos/storage'

var KEY_NAV = 'rm_nav'
var KEY_STATUS = 'rm_status'

export function getNavData() {
  try {
    var d = localStorage.getItem(KEY_NAV)
    return d ? JSON.parse(d) : null
  } catch (e) {
    return null
  }
}

export function getStatus() {
  return localStorage.getItem(KEY_STATUS) || 'idle'
}
