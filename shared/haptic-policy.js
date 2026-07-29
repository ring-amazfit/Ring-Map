function createHapticState() {
  return { lastToken: '', lastAt: 0, lastProximityKey: '' }
}

function copyHapticState(state) {
  return {
    lastToken: state && state.lastToken || '',
    lastAt: Number(state && state.lastAt || 0),
    lastProximityKey: state && state.lastProximityKey || ''
  }
}

function distanceMeters(snapshot) {
  if (!snapshot) return 0
  return Number(snapshot.distanceMeters || snapshot.distance || 0)
}

function evaluateHaptic(current, modeValue, snapshot, previous, nowValue) {
  var state = copyHapticState(current || createHapticState())
  var mode = modeValue === 'off' || modeValue === 'proximity' ? modeValue : 'turn'
  var now = Number(nowValue || 0)
  var token = String(snapshot && snapshot.hapticToken || '')
  if (!snapshot || !token) return { state: state, vibrate: false, duration: 0, reason: 'missing_token' }

  if (token !== state.lastToken) {
    state.lastToken = token
    state.lastProximityKey = ''
    if (mode === 'off' || snapshot.action === 'wait') {
      return { state: state, vibrate: false, duration: 0, reason: 'muted_instruction' }
    }
    if (now - state.lastAt < 8000) {
      return { state: state, vibrate: false, duration: 0, reason: 'cooldown' }
    }
    state.lastAt = now
    return { state: state, vibrate: true, duration: 180, reason: 'new_instruction' }
  }

  if (mode !== 'proximity' || !previous || previous.hapticToken !== token) {
    return { state: state, vibrate: false, duration: 0, reason: 'same_instruction' }
  }

  var previousDistance = distanceMeters(previous)
  var currentDistance = distanceMeters(snapshot)
  var thresholds = [80, 200, 500]
  for (var index = 0; index < thresholds.length; index++) {
    var threshold = thresholds[index]
    var key = token + ':' + threshold
    if (previousDistance > threshold && currentDistance <= threshold
        && state.lastProximityKey !== key) {
      state.lastProximityKey = key
      if (now - state.lastAt < 8000) {
        return { state: state, vibrate: false, duration: 0, reason: 'cooldown' }
      }
      state.lastAt = now
      return { state: state, vibrate: true, duration: 220, reason: 'proximity_' + threshold }
    }
  }
  return { state: state, vibrate: false, duration: 0, reason: 'no_threshold' }
}

export { createHapticState, evaluateHaptic }
