const assert = require('assert')
const fs = require('fs')

const app = fs.readFileSync('app.js', 'utf8')
const side = fs.readFileSync('app-side/index.js', 'utf8')
const server = fs.readFileSync('android/app/src/main/java/com/ringmap/nav/NavWebSocketServer.java', 'utf8')

assert(app.includes('recoveryId'), 'Device App must create one recovery correlation id per wake/relaunch')
assert(app.includes('watchReadyAt'), 'Device App must timestamp watch_ready at its source')
assert(app.includes('recoveryId: appData.recoveryId'), 'Device App recovery packets must identify their wake')
assert(app.includes('recoveryId: snapshot.recoveryId'), 'Device ACKs must echo the recovery id from the received snapshot')

assert(side.includes('recoveryId: sourcePacket && sourcePacket.recoveryId'), 'App-Side must preserve the Device App recovery id when it requests Android authority state')
assert(side.includes('recoveryMatches(packet, wakeRecovery)'), 'App-Side must cancel a wake deadline only for its correlated Android authority response')
assert(side.includes('dispatchWakeRecovery') && side.includes('connectionEpoch'), 'a pending wake recovery must survive socket connection and reconnect transitions')

assert(server.includes('packet.optString("recoveryId", "")'), 'Android must read a recovery id from hello/resync')
assert(server.includes('sendCurrentState(connection, recoveryId'), 'Android must correlate the returned authority state with the triggering wake')
assert(server.includes('"androidResyncReceivedAt"'), 'Android must attach the receive timestamp to a correlated authority response')
assert(server.includes('"androidResyncSentAt"'), 'Android must attach the send timestamp to a correlated authority response')

console.log('wake recovery trace contracts passed')
