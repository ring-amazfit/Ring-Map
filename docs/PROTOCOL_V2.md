# RingMap Protocol v2

## Authority

Android owns navigation sessions. Zepp App-Side and the watch are latest-state replicas. They never reconstruct a route and never replay an old maneuver queue.

## State model

```text
IDLE -> ACTIVE(sessionId, seq) -> STALE -> ENDED(tombstone) -> IDLE
```

- A new valid navigation source creates a UUID `sessionId`.
- `seq` starts at 1 and increases for every accepted snapshot and terminal event.
- `stateRevision` is a strictly increasing Android authority watermark on snapshot, end, and idle packets. Receivers retain the latest revision and an ended-session tombstone so delayed packets cannot revive or clear newer state.
- The current source package is locked for the active session.
- A second supported map may take over only after the previous source has had no accepted snapshot for more than 90 seconds.
- A snapshot expires on the watch 45 seconds after local receipt. STALE hides the old action and distance; it does not claim the phone navigation ended.

## Envelope

```json
{
  "protocolVersion": 2,
  "type": "nav_snapshot",
  "stateRevision": 1,
  "sessionId": "uuid",
  "sessionStartedAt": 0,
  "seq": 42,
  "state": "active",
  "eventId": "uuid:42",
  "fingerprint": "semantic-hash",
  "capturedAt": 0,
  "parsedAt": 0,
  "emittedAt": 0,
  "ttlMs": 45000,
  "sourcePackage": "com.autonavi.minimap",
  "sourceName": "高德地图",
  "quality": "complete",
  "action": "turn_left",
  "distanceMeters": 200,
  "distanceText": "200米",
  "road": "中山路",
  "instruction": "前方200米左转进入中山路",
  "instructionId": "semantic-hash",
  "hapticToken": "session:instruction"
}
```

## Message types

| Type | Direction | Purpose |
| --- | --- | --- |
| `hello` | App-Side -> Android | Identify bridge and request authority state |
| `resync` | Watch/App-Side -> Android | Request current snapshot, end, or idle |
| `bridge_state` | Android/App-Side -> Watch | Transport status only |
| `nav_snapshot` | Android -> Watch | Complete current render state |
| `nav_end` | Android -> Watch | End one exact session |
| `nav_ack` | Watch -> Android | `accepted` or `applied`, exact session and seq |
| `ping` / `pong` | App-Side <-> Android | Application-level health check |
| `idle` | Android -> Watch | Authority has no active navigation |

## Acceptance rules

1. Reject unsupported protocol versions.
2. Reject authority packets whose `stateRevision` is older than the retained watermark. Older v2 senders fall back to `emittedAt` as the watermark.
3. Within one session, accept only `seq > lastAppliedSeq`; the sole exception is an exact same-session/same-seq snapshot renewing a STALE display.
4. Reject a different session whose `sessionStartedAt` is not newer, including while IDLE with an ended-session tombstone.
5. Apply `nav_end` only when its `sessionId` equals the current session and its seq is not older; retain its identity and revision as a tombstone.
6. Apply `idle` only when its authority revision is newer than the retained state.
7. App-Side reduces `ttlMs` to the remaining lifetime derived from the original `emittedAt`. A newly received live snapshot may be forwarded with as little as 1 second remaining; persisted cache replays require at least 5 seconds remaining. The watch measures the forwarded remainder from receipt time.
8. A `quality=partial` banner cannot replace a fresh complete instruction.
9. Identical semantic fingerprints within 5 seconds are dropped. Later identical refreshes may renew TTL but retain the same haptic token.

## Connection recovery

Each Zepp App-Side context allows one WebSocket and one reconnect timer. Every socket callback captures a connection epoch; callbacks from replaced sockets in that context are ignored. Reconnect delays are 1, 2, 4, 8, then 15 seconds with bounded jitter. While a watch is asleep, ZeppOS may suspend App-Side heartbeats; Android therefore does not use a server-side ping eviction timer. The Device App sends `watch_sleep` before teardown; App-Side then retains only the latest authority snapshot and does not enqueue its periodic refreshes across the phone-watch transport. On wake, `watch_ready` / `resync` immediately delivers that single latest snapshot and requests current authority state.

Zepp may run multiple legitimate companion contexts at once. Android accepts those localhost clients concurrently instead of letting them evict one another. On open or `hello/resync`, Android sends only the current fresh authority state.

## Timing fields

- Android: `capturedAt`, `parsedAt`, `emittedAt`
- App-Side: `bridgeReceivedAt`, `bridgeSentAt`
- Watch ACK: `watchReceivedAt`, `widgetAppliedAt`
- Android receipt: local `ackReceivedAt`

The Android UI reports clock-safe durations:

- parse: `parsedAt - capturedAt`
- App-Side receive: `bridgeReceivedAt - emittedAt` (same phone clock)
- bridge dispatch: `bridgeSentAt - bridgeReceivedAt`
- watch widget apply: `widgetAppliedAt - watchReceivedAt` (same watch clock)
- round trip: Android ACK receipt minus Android emitted time

## Privacy

Protocol traffic is local to the Android phone and the paired Zepp channel. The app does not upload payloads. UI diagnostics record action names, sequence numbers, connection states, and durations; raw route text and road names are excluded from the event ring.
