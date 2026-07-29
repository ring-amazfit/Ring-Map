function createNavState() {
  return {
    status: 'idle',
    bridgeStatus: 'connecting',
    sessionId: '',
    sessionStartedAt: 0,
    seq: 0,
    snapshot: null,
    receivedAt: 0,
    expiresAt: 0,
    authorityRevision: 0,
    lastReason: ''
  }
}

function copyState(state) {
  return {
    status: state.status,
    bridgeStatus: state.bridgeStatus,
    sessionId: state.sessionId,
    sessionStartedAt: state.sessionStartedAt,
    seq: state.seq,
    snapshot: state.snapshot,
    receivedAt: state.receivedAt,
    expiresAt: state.expiresAt,
    authorityRevision: state.authorityRevision || 0,
    lastReason: state.lastReason
  }
}

function result(state, changed, reason) {
  state.lastReason = reason
  return { state: state, changed: changed, reason: reason }
}

function packetNumber(value, fallback) {
  var parsed = Number(value)
  return isFinite(parsed) ? parsed : fallback
}

function packetRevision(packet) {
  return packetNumber(packet.stateRevision, packetNumber(packet.emittedAt, 0))
}

function reduceNavPacket(current, packet, receivedAt) {
  var state = current || createNavState()
  if (!packet || typeof packet !== 'object') return result(state, false, 'invalid_packet')
  var now = packetNumber(receivedAt, Date.now())
  if (packet.protocolVersion !== 2) return result(state, false, 'unsupported_protocol')

  if (packet.type === 'bridge_state') {
    var bridge = String(packet.status || 'disconnected')
    if (state.bridgeStatus === bridge) return result(state, false, 'same_bridge_state')
    var bridgeState = copyState(state)
    bridgeState.bridgeStatus = bridge
    return result(bridgeState, true, 'bridge_state')
  }

  if (packet.type === 'idle') {
    var idleRevision = packetRevision(packet)
    if (idleRevision <= 0) return result(state, false, 'invalid_idle')
    if (state.authorityRevision && idleRevision <= state.authorityRevision) {
      return result(state, false, 'old_authority')
    }
    var idle = copyState(state)
    idle.status = 'idle'
    idle.snapshot = null
    idle.receivedAt = now
    idle.expiresAt = 0
    idle.authorityRevision = idleRevision
    return result(idle, state.status !== 'idle' || !!state.snapshot
      || idleRevision !== state.authorityRevision, 'idle')
  }

  if (packet.type === 'nav_snapshot') {
    var sessionId = String(packet.sessionId || '')
    var seq = packetNumber(packet.seq, 0)
    var startedAt = packetNumber(packet.sessionStartedAt, packetNumber(packet.emittedAt, 0))
    var snapshotRevision = packetRevision(packet)
    if (!sessionId || seq <= 0 || startedAt <= 0 || snapshotRevision <= 0) {
      return result(state, false, 'invalid_snapshot')
    }

    var renewedStaleSnapshot = state.status === 'stale'
      && state.sessionId === sessionId
      && seq === state.seq
      && startedAt === state.sessionStartedAt
    if (state.sessionId === sessionId && seq <= state.seq && !renewedStaleSnapshot) {
      return result(state, false, 'old_seq')
    }
    if (state.authorityRevision && snapshotRevision < state.authorityRevision) {
      return result(state, false, 'old_authority')
    }
    if (state.sessionId && state.sessionId !== sessionId
        && startedAt <= state.sessionStartedAt) {
      return result(state, false, 'old_session')
    }

    var ttl = packetNumber(packet.ttlMs, 45000)
    if (ttl < 5000) ttl = 5000
    if (ttl > 120000) ttl = 120000
    var active = copyState(state)
    active.status = 'active'
    active.sessionId = sessionId
    active.sessionStartedAt = startedAt
    active.seq = seq
    active.snapshot = packet
    active.receivedAt = now
    active.expiresAt = now + ttl
    active.authorityRevision = Math.max(state.authorityRevision || 0, snapshotRevision)
    return result(active, true, renewedStaleSnapshot ? 'renewed_snapshot' : 'snapshot')
  }

  if (packet.type === 'nav_end') {
    var endSession = String(packet.sessionId || '')
    var endSeq = packetNumber(packet.seq, 0)
    if (!state.sessionId || endSession !== state.sessionId) {
      return result(state, false, 'different_session_end')
    }
    if (endSeq < state.seq) return result(state, false, 'old_seq')
    var endRevision = packetRevision(packet)
    if (endRevision <= 0) return result(state, false, 'invalid_end')
    if (state.authorityRevision && endRevision < state.authorityRevision) {
      return result(state, false, 'old_authority')
    }
    var ended = copyState(state)
    ended.status = 'idle'
    ended.snapshot = null
    ended.receivedAt = now
    ended.expiresAt = 0
    ended.seq = endSeq
    ended.authorityRevision = Math.max(state.authorityRevision || 0, endRevision)
    return result(ended, true, 'ended')
  }

  return result(state, false, 'ignored_type')
}

function expireNavState(current, nowValue) {
  var state = current || createNavState()
  var now = packetNumber(nowValue, Date.now())
  if (state.status !== 'active' || !state.expiresAt || now <= state.expiresAt) {
    return result(state, false, 'fresh')
  }
  var stale = copyState(state)
  stale.status = 'stale'
  stale.snapshot = null
  stale.receivedAt = now
  stale.expiresAt = 0
  return result(stale, true, 'stale')
}

export { createNavState, reduceNavPacket, expireNavState }
