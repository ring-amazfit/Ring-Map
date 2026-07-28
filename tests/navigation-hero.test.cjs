const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('page/navigation.js', 'utf8')

assert(source.includes('state: { timer: null, recoveryTicks: 0, arrowWidgets: [], lastAction: \'waiting\', status: null, action: null'), 'navigation page needs a dedicated action label widget')
assert(source.includes('function actionTitle'), 'navigation page needs readable action labels')
assert(source.includes("type !== 'waiting'"), 'waiting state must not show a false straight arrow')
assert(source.includes("this.state.progress.setProperty(prop.MORE, { w: px(4)"), 'progress must reset when navigation data disappears')
assert(!source.includes('w: px(364), h: px(326)'), 'navigation hero should not use the old oversized card')
assert(source.includes("text(86, 54, 308, 24"), 'navigation hero needs a compact action slot')
assert(source.includes('DISTANCE_Y') && source.includes('self.state.distance = text(60, DISTANCE_Y'), 'navigation hero needs a fixed distance slot')
console.log('navigation hero layout tests passed')
