var BG_DARK = '#050505'
var CARD_BG = '#161616'
var CARD_SOFT = '#222222'
var LINE = '#373737'
var TEXT_PRIMARY = '#F4F4F4'
var TEXT_SECONDARY = '#A4A4A4'
var TEXT_MUTED = '#696969'
var ACTIVE = '#F4F4F4'

function Card(children) {
  return View({ style: { background: CARD_BG, borderRadius: '16px', padding: '16px', marginBottom: '14px' } }, children)
}

function Heading(value) {
  return Text({ style: { fontSize: '14px', fontWeight: 'bold', color: TEXT_PRIMARY, marginBottom: '8px' }, text: value })
}

AppSettingsPage({
  build(props) {
    var ss = props.settingsStorage
    var status = ss.getItem('_rm_status') || 'idle'
    var msg = ss.getItem('_rm_msg') || ''
    var statusColor = status === 'connected' || status === 'navigating' ? ACTIVE : TEXT_SECONDARY
    var statusText = status === 'navigating' ? '导航同步中' : status === 'connected' ? '手机端已连接' : '等待手机端连接'

    return View({ style: { background: BG_DARK, width: '100%', minHeight: '100%' } }, [
      Text({ style: { fontSize: '22px', fontWeight: 'bold', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: '4px', marginTop: '18px' }, text: '环间导航' }),
      Text({ style: { fontSize: '12px', color: TEXT_SECONDARY, textAlign: 'center', marginBottom: '18px' }, text: '手机导航 · 手表显示' }),

      Card([
        Heading('连接状态'),
        Text({ style: { fontSize: '14px', color: statusColor, marginBottom: '5px' }, text: statusText }),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY }, text: msg || '打开手机端 RingMap，并在手表打开导航主页' })
      ]),

      Card([
        Heading('骑行偏好'),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY, marginBottom: '6px' }, text: '自动进入导航：收到新导航时自动打开手表导航页' }),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY, marginBottom: '6px' }, text: '骑行大字：放大距离和当前指令，方便抬腕查看' }),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY }, text: '导航震动：每次下一步指令变化时提醒' })
      ]),

      Card([
        Heading('使用说明'),
        View({ style: { width: '36px', height: '2px', borderRadius: '1px', background: ACTIVE, marginBottom: '10px' } }, []),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY, marginBottom: '6px' }, text: '在手机系统高德地图中开始导航' }),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY, marginBottom: '6px' }, text: '手表端自动显示下一步转向与距离' }),
        Text({ paragraph: true, style: { fontSize: '12px', color: TEXT_SECONDARY }, text: '导航数据来自手机端通知监听' })
      ]),

      Card([
        Heading('关于'),
        Text({ style: { fontSize: '12px', color: TEXT_SECONDARY }, text: '环间导航 2.1.0\n手机端 2.6.1\nZepp OS 3.0+' })
      ]),

      Text({ style: { fontSize: '11px', color: TEXT_MUTED, textAlign: 'center', marginTop: '3px', marginBottom: '20px' }, text: '黑白高对比导航界面' })
    ])
  }
})
