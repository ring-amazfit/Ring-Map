<p align="center">
  <img src="./icon.png" width="112" alt="RingMap icon">
</p>

<h1 align="center">RingMap</h1>

<p align="center"><a href="./README.md">简体中文</a></p>

<p align="center">A cycling navigation companion that mirrors Amap and Baidu Map system navigation notifications to Amazfit Zepp OS round watches.</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#setup">Setup</a> ·
  <a href="#development">Development</a> ·
  <a href="./LICENSE">MIT License</a>
</p>

> [!NOTE]
> Current preview: Android `Alpha-2` (version code `13`) · ZeppOS `v1.1.1` (version code `18`) · App ID `1121554` · Zepp OS 3.0+.

## Features

### Android notification bridge

- Reads only Amap and Baidu Map Android system navigation notifications. It does not use map SDKs, route planning, location, or map web APIs.
- Mirrors the current maneuver, distance, road, and source through the local companion bridge to the watch.
- Android is the only navigation-session authority. The App-Side and watch retain the newest valid snapshot and reject old sequences, expired maneuvers, and delayed end events.
- Supports straight, left/right turns, slight/sharp turns, U-turns, lane keeping, roundabouts, merges, forks, exits, arrival, rerouting, and waiting states.

### Watch navigation

- Uses 152px color maneuver artwork, large distance text, road/source status, and text-only waiting states that never retain an old direction.
- Includes Night Corridor, Pure Black, and Navigator themes. “Navigator” remains compatible with the existing `anime` storage key.
- Supports automatic navigation entry, large cycling text, keep-screen-on, source display, and off, turn, and proximity haptic modes.
- After a screen-off relaunch, restores only a still-valid local snapshot, completes the connection handshake, and requests the current Android authority state without replaying an old queue.

### Connection protection and diagnostics

- The Android companion shows notification access, actual listener connection, background bridge, Zepp App-Side connection, and watch acknowledgement status.
- Enhanced connection reports the real battery-unrestricted state and opens the official Android allowlist flow. The companion also explains auto-start, background operation, and avoiding Recents cleanup where supported.
- A system force-stop terminates the app process, foreground service, and notification listener. A normal Android app cannot revive itself from this state; reopen RingMap to recover.
- Android, App-Side, and watch acknowledgement messages include timing fields for diagnosing notification parsing, bridge, connection, and rendering delays.

### First connection

- First use requires the Android companion and a Zepp connection to the watch. Activation completes only after an actual Android bridge connection reaches the watch.
- The unactivated watch home and About page provide the Android companion download QR entry.
- Android companion download: <https://1822094521.share.123pan.cn/123pan/BvJBjv-BR4Gh>

## Screenshots

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/images/android-status.jpg" alt="Android synchronization state" width="100%"><br>
      <sub><b>Synchronization state</b><br>Permissions, listener, bridge, and watch acknowledgement</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/images/android-live-navigation.jpg" alt="Android live navigation" width="100%"><br>
      <sub><b>Live navigation</b><br>Notification mirror and Android-to-watch synchronization</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/images/watch-left-turn.jpg" alt="Watch maneuver" width="100%"><br>
      <sub><b>Watch maneuver</b><br>Direction, distance, road, and source</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/images/watch-waiting.jpg" alt="Watch waiting state" width="100%"><br>
      <sub><b>Waiting state</b><br>Text-only state when no valid maneuver is available</sub>
    </td>
  </tr>
</table>

## Supported Watches

`app.json` currently declares these round Amazfit targets:

| Series | Target resolution | Input |
| --- | ---: | --- |
| Amazfit Balance | 480 × 480 | Touch |
| Amazfit Cheetah Pro | 480 × 480 | Touch |
| Amazfit T-Rex 3 | 480 × 480 | Touch |
| Amazfit T-Rex 3 Pro | 480 × 480 | Touch |
| Amazfit Active 2 (round) | 466 × 466 | Touch |
| Amazfit GTR 4 / GTR 4 LE | 466 × 466 | Touch |

> [!NOTE]
> These are the round-screen targets currently declared in `app.json`. Actual availability also depends on the watch OS, region, Zepp App version, and device selection in the developer console.

## Setup

### Install and activate

1. Scan the watch activation QR or open the [Android companion download link](https://1822094521.share.123pan.cn/123pan/BvJBjv-BR4Gh).
2. Install and open RingMap for Android once.
3. Grant Android Notification Access to RingMap. “Listener connected” in RingMap is the real confirmation that Android has bound the listener.
4. Install RingMap on the watch through Zepp and keep Zepp connected to the watch.
5. Watch activation completes automatically after the Android navigation bridge reaches the watch.

### Protect the Android bridge

1. Open Settings in RingMap for Android.
2. Open Enhanced connection and allow Battery unrestricted through the official Android system prompt if appropriate.
3. Open Background operation guide and enable auto-start/background operation in your OEM settings where available.
4. Do not remove RingMap from Recents while navigation is active. Some systems treat that action as a force-stop and the app cannot recover by itself.

> [!WARNING]
> “Notification Access granted” is not the same as “Listener connected”. If the listener remains connecting, disable and re-enable RingMap Notification Access in Android Settings, then refresh RingMap.

### Navigate

1. Start navigation in Amap or Baidu Map.
2. Keep the map app's navigation notification available.
3. RingMap automatically opens the watch navigation page, or open Navigation from the watch home page.
4. When waking after a long screen-off interval, RingMap requests fresh state automatically. Always follow the phone map app and real road conditions.

> [!WARNING]
> RingMap is not a map, location, routing, or road-safety service. Always follow the phone map app and actual road conditions. Ride safely.

### Privacy and data

- No account, location, contacts, camera, microphone, photos, or health data.
- After Notification Access is granted, Android transiently reads navigation notification content to derive the current maneuver, distance, road, and source. Notification text is not written to RingMap diagnostics or uploaded to developer servers.
- The current navigation step is synchronized only across the local Android device, Zepp App-Side, and connected watch. RingMap does not upload navigation text, routes, locations, or diagnostics.
- Read the full [Privacy Statement](./PRIVACY.md) for the complete boundary.

## Development

### Prerequisites

- Current Node.js LTS
- Zepp OS development environment and Zeus CLI
- JDK 17+
- Android SDK (compileSdk 35)

### Install dependencies

```bash
npm install
```

### Build packages

```bash
npm run release:watch
```

Build artifacts are written to `dist/`. The release script builds supported targets and generates version and SHA-256 manifests.

The Android companion is in the repository's `android/` directory and can be built with Android Studio or Gradle:

```bat
cd android
gradlew.bat clean testDebugUnitTest assembleDebug
```

### Start Zeus preview

```bash
npm run preview
```

## Project Structure

```text
app.js                 Device App state, connection handshake, TTL, routing, and acknowledgements
app-side/index.js      Android WebSocket and watch-message relay
page/                  Watch home, activation, navigation, theme, settings, and about
shared/                Messaging, protocol, and haptic pure logic
assets/<target>/       Native target assets and companion-download QR code
android/               Directly buildable Android companion source
scripts/               Android sync, multi-target release, and market asset tools
tests/                 Node protocol, assets, product, and mirror contracts
docs/                  Protocol, design, screenshots, and market materials
```

## Verification

```bash
npm test
npm run build
```

Before release, also run Android unit tests, the Debug build, the ZeppOS multi-target build, Android mirror equivalence, and the release manifest checks. See [docs/PROTOCOL_V2.md](./docs/PROTOCOL_V2.md) for protocol details.

## License

This project is released under the [MIT License](./LICENSE). You may use, modify, distribute, or commercialize it while retaining the copyright and license notice.
