const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('page/navigation.js', 'utf8')
const icons = fs.readFileSync('utils/icons.js', 'utf8')

assert(source.includes('createActionIcon'), 'navigation page must use image action icons')
assert(source.includes("this.renderArrow('wait')"), 'waiting state must use the non-directional wait icon')
assert(source.includes('deleteAll(this.state.arrowWidgets)'), 'navigation page must delete the previous icon before redraw')
assert(source.includes('actionIcon(nav.action)'), 'navigation page must normalize actions through the shared action map')
assert(source.includes('this.state.lastAction'), 'icon redraw must be deduplicated by action')
assert(icons.includes('widget.IMG'), 'icon helper must create an image widget')
for (const [action, file] of Object.entries({
  straight: 'nav-straight.png', turn_left: 'nav-turn-left.png', turn_right: 'nav-turn-right.png',
  slight_left: 'nav-slight-left.png', slight_right: 'nav-slight-right.png',
  uturn_left: 'nav-uturn-left.png', uturn_right: 'nav-uturn-right.png',
  arrive: 'nav-arrive.png', wait: 'nav-wait.png'
})) {
  assert(icons.includes(`${action}: '${file}'`), `${action} must use its bundled PNG`)
}
assert(!source.includes('a.push(line'), 'legacy geometric arrow drawing must be removed')
assert(!source.includes('mask:'), 'navigation icons must retain source color')
console.log('navigation arrow behavior tests passed')
