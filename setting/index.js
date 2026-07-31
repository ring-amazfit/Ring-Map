var BG = '#070A0C'
var PANEL = '#111719'
var LINE = '#263238'
var TEXT = '#F6FAF8'
var SUB = '#B5C2C8'
var MUTED = '#6F7C83'
var CYAN = '#2EDCF2'

function Panel(children) {
  return View({ style: { background: PANEL, borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid ' + LINE } }, children)
}

function Heading(value) {
  return Text({ style: { fontSize: '14px', fontWeight: 'bold', color: TEXT, marginBottom: '8px' }, text: value })
}

AppSettingsPage({
  build(props) {
    var storage = props.settingsStorage
    var status = storage.getItem('_rm_status') || 'idle'
    var message = storage.getItem('_rm_msg') || ''
    var online = status === 'connected' || status === 'navigating'
    var statusText = status === 'navigating' ? '导航同步中' : online ? '导航桥在线' : '等待 Android 导航桥'

    return View({ style: { background: BG, width: '100%', minHeight: '100%', padding: '16px' } }, [
      Text({ style: { fontSize: '24px', fontWeight: 'bold', color: TEXT, textAlign: 'center', marginTop: '8px' }, text: 'RINGMAP' }),
      Text({ style: { fontSize: '12px', color: CYAN, textAlign: 'center', marginTop: '4px', marginBottom: '18px' }, text: 'Android Alpha-2 · ZeppOS 1.1.1 · 协议 v2' }),

      Panel([
        Heading('连接状态'),
        Text({ style: { fontSize: '15px', color: online ? CYAN : SUB, marginBottom: '5px' }, text: statusText }),
        Text({ paragraph: true, style: { fontSize: '12px', color: SUB }, text: message || '连接信息会随 App-Side 状态自动更新' })
      ]),

      Panel([
        Heading('手表端偏好'),
        Text({ style: { fontSize: '12px', color: SUB, marginBottom: '5px' }, text: '自动进入导航 · 骑行大字 · 持续亮屏' }),
        Text({ style: { fontSize: '12px', color: SUB }, text: '振动提醒：关闭 / 转向 / 临近距离' })
      ]),

      Panel([
        Heading('数据边界'),
        Text({ paragraph: true, style: { fontSize: '12px', color: SUB }, text: '只同步高德、百度系统导航通知；不定位、不调用地图 API、不上传导航正文。' })
      ]),

      Panel([
        Heading('开源仓库'),
        Text({ style: { fontSize: '12px', color: CYAN }, text: 'github.com/ring-amazfit/Ring-Map' }),
        Text({ style: { fontSize: '11px', color: MUTED, marginTop: '6px' }, text: '部分导航箭头来自 Icons8' })
      ]),

      Text({ style: { fontSize: '11px', color: MUTED, textAlign: 'center', marginTop: '4px', marginBottom: '18px' }, text: 'App ID 1121554' })
    ])
  }
})
