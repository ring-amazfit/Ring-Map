# RingMap ZeppOS Market Submission Kit

Status: release-candidate material. This kit is ready for the Zepp developer console fields, but market submission remains blocked until the release checklist's real-device and third-party rights items are recorded.

## Console Field Checklist

| Console field | Release-candidate value | Final submission status |
| --- | --- | --- |
| App ID | `1121554` | Ready |
| App version | `1.1.1` / code `18` | Build required |
| Country / region | Choose in Zepp Console | Console owner decision required |
| Developer display name | Choose in Zepp Console | Console owner decision required |
| App classification | Navigation / Sports and outdoors | Confirm against current Console choices |
| Supported devices | Use only `app.json` deviceSource values | Recheck after packages are built |
| Languages | Simplified Chinese and English | Ready |
| App package includes SDK | No third-party SDK is bundled in the ZeppOS package | Confirm in Console |
| Data permissions | Declare the three `app.json` permissions below | Ready |
| Store icon | `docs/market-assets/store-icon-240.png` | Ready |
| Store screenshots | Five `docs/market-assets/screen-*-360.png` files | Ready |
| Privacy statement | Copy from `PRIVACY.md` | Ready |
| Third-party rights | Icons8 and owner-supplied artwork | Written redistribution confirmation required |

## Release Identity

| Field | Value |
| --- | --- |
| App name (zh-CN) | 环间导航 |
| App name (en-US) | RingMap |
| App ID | `1121554` |
| Version | `1.1.1` |
| Version code | `18` |
| Runtime | Zepp OS API 3.0+ |
| Category | Navigation / Sports and outdoors |
| Supported form factor | Round Amazfit watches only |

## Store Summary

### Chinese

将高德地图与百度地图的系统导航通知同步到 Amazfit 手表。手机端不定位、不规划路线、不调用地图 API；手表只显示当前下一步动作、距离和道路信息。

### English

Mirror Amap and Baidu Map system navigation notifications to compatible Amazfit watches. RingMap does not locate you, plan routes, or call map APIs. The watch shows only the current maneuver, distance, and road information.

## Full Description

### Chinese

RingMap 是一款 Android 配套的 Amazfit 手表导航提示应用。开始高德地图或百度地图导航后，RingMap 从 Android 系统通知中读取当前导航步骤，并通过 Zepp 连接同步到手表。

- 显示当前转向、距离、道路名称和导航来源。
- 支持高德地图与百度地图的系统导航通知。
- 提供夜骑道路、纯黑、导航娘三种手表主题。
- 支持自动进入导航、骑行大字、持续亮屏和三档震动提醒。
- 息屏唤醒后自动恢复最近有效导航状态，并向手机端请求最新快照。
- Android 配套端提供通知监听、同步状态、手表确认和不含通知正文的本地诊断。

使用前请安装 Android 配套端，授予“通知使用权”，在 Zepp 中安装并连接手表端 RingMap。为降低某些 Android 系统清理后台后造成的中断，请在 Android 配套端的“设置 - 增强连接”中按教程允许电池不限制、自启动和后台运行，并不要从最近任务中清理 RingMap。

RingMap 不提供地图、定位、路线规划、搜索、导航 API 或驾驶安全提示。请始终以手机地图应用和道路实际情况为准，骑行时注意安全。

### English

RingMap is an Android companion app for Amazfit watches. When navigation is active in Amap or Baidu Map, RingMap reads the current navigation step from the Android system notification and mirrors it to the watch through Zepp.

- Shows the current maneuver, distance, road name, and map source.
- Supports Amap and Baidu Map system navigation notifications.
- Includes Night Corridor, Pure Black, and Navigator themes.
- Offers automatic navigation entry, large cycling text, keep-screen-on, and three haptic modes.
- Restores a recent valid state after wake and requests the latest state from the Android companion.
- The Android companion shows notification access, bridge state, watch acknowledgement, and local diagnostics that do not retain notification text.

Install the Android companion, grant Notification Access, then install and connect RingMap in Zepp. To reduce interruptions on Android systems that aggressively clean background apps, follow Settings - Enhanced connection in the Android companion and enable battery unrestricted mode, auto-start, and background operation where available. Do not remove RingMap from Recents while navigation is active.

RingMap is not a map, location, routing, search, navigation API, or road-safety service. Always follow the phone map app and real road conditions. Ride safely.

## Privacy Statement

### Chinese

RingMap 不创建账号，不要求定位、通讯录、相机、麦克风、相册或健康数据权限。

- Android 配套端会读取导航通知的标题、正文、大文本、子文本、摘要、信息文本和多行文本，以在当前 Android 进程、Zepp App-Side 与已连接手表间提取和显示当前动作、距离、道路与来源；通知正文不写入 RingMap 诊断事件或开发者服务器。
- 当前导航步骤仅用于在本机 Android、Zepp App-Side 和已连接手表之间同步；RingMap 不上传导航正文、路线、位置或诊断事件到开发者服务器。
- Android 不持久化导航正文，且已关闭 Android 自动备份；手表主题、显示和震动设置保存在手表本地。
- `INTERNET` 权限仅服务于 Android 设备本机 `127.0.0.1:8886` 的 WebSocket 桥接，不用于连接开发者服务器。
- 如卸载应用，Android 应用私有数据会由系统处理；手表端本地设置可在系统卸载应用时删除。

### English

RingMap does not create accounts and does not request location, contacts, camera, microphone, photos, or health-data permissions.

- After the user grants Notification Access, the Android companion reads navigation notification title, text, big text, subtext, summary, info text, and text lines to derive and show the current maneuver, distance, road, and source in the current Android process, Zepp App-Side, and connected watch. Notification text is not retained in RingMap diagnostic events or developer servers.
- The current navigation step is used only to synchronize between the local Android device, Zepp App-Side, and the connected watch. RingMap does not upload navigation text, routes, locations, or diagnostic events to developer servers.
- Android does not persist navigation text and Android automatic backup is disabled. Watch themes, display settings, and haptic settings are stored locally on the watch.
- The `INTERNET` permission is used only for the device-local WebSocket bridge at `127.0.0.1:8886`, not for developer servers.
- When the app is removed, Android private data is handled by the system. Watch-local settings can be removed when the app is uninstalled.

## Permissions Explanation

| Permission | Why it is needed |
| --- | --- |
| `device:os.local_storage` | Store local watch preferences and the latest valid snapshot for wake recovery. |
| `device:os.network` | Allow the Zepp App-Side companion to use the local Android bridge. |
| `data:os.device.info` | Read device information required by the ZeppOS runtime. |

The Android companion separately requires Android Notification Access, shown and requested from its own settings page.

## Console Assets

Zepp's current circular-device submission guidance requires a `240 x 240` transparent PNG store icon and `360 x 360` transparent PNG application screenshots. These prepared files are the only images intended for those Console fields:

| File | Console use |
| --- | --- |
| `docs/market-assets/store-icon-240.png` | Store icon |
| `docs/market-assets/screen-navigation-turn-360.png` | Navigation maneuver screenshot |
| `docs/market-assets/screen-navigation-waiting-360.png` | Text-only waiting-state screenshot |
| `docs/market-assets/screen-navigation-theme-360.png` | Theme/navigation screenshot |
| `docs/market-assets/screen-settings-360.png` | Settings screenshot |
| `docs/market-assets/screen-about-360.png` | About screenshot |

The source phone screenshots below are documentation only. `android-zepp-background-permissions.jpg` is a system-setting example and is not a RingMap app screenshot; do not upload it to the ZeppOS application-screenshot field.

## Documentation Screenshots

Use the following screenshots as the repository and market submission set. The Zepp developer console may impose a size, aspect ratio, or count limit; upload only images accepted by that console without altering what the screenshot represents.

| File | Caption |
| --- | --- |
| `docs/images/watch-left-turn.jpg` | Watch navigation: turn direction, distance, and road. |
| `docs/images/watch-waiting.jpg` | Watch waiting state: text-only state when no valid maneuver exists. |
| `docs/images/android-status.jpg` | Android companion: notification listener, service, bridge, and watch acknowledgement state. |
| `docs/images/android-live-navigation.jpg` | Android companion: live navigation mirror and timing diagnostics. |
| `docs/images/android-zepp-background-permissions.jpg` | Android/Zepp background-permission setting example, not a RingMap market screenshot. |

## Generated Release Artifacts (2026-07-30)

The following source-matched packages were generated by `npm run release:watch`. The script unpacked every `.zab` and verified `manifest.json` version `1.1.1` / code `18` and the listed `deviceSource` values before publishing `dist/`. The complete machine-readable record is `dist/RELEASE_MANIFEST.json`; `dist/SHA256SUMS.txt` covers every package and the manifest.

| Device package | `deviceSource` | SHA-256 |
| --- | --- | --- |
| `RingMap-ZeppOS-1.1.1-balance-8519936-8519937-8519939.zab` | 8519936, 8519937, 8519939 | `cd3ddeeff8555b09ddc69e1b8fecc8cf772e3f6660a64421fabae8cc3c9a7293` |
| `RingMap-ZeppOS-1.1.1-cheetahpro-8126720-8126721.zab` | 8126720, 8126721 | `d4cd9fc910190759735e0e95aeec7bc7cf8280db8f707f8b5496a844cdefab8b` |
| `RingMap-ZeppOS-1.1.1-active2-8913152-8913153-10092800-10092801.zab` | 8913152, 8913153, 10092800, 10092801 | `c0cfce2a59692c9621c4695737b439e92597d55c078eca3bcef64bdf6ff8e283` |
| `RingMap-ZeppOS-1.1.1-active2-8913155-8913159-10092803-10092807.zab` | 8913155, 8913159, 10092803, 10092807 | `8486ffe7b3a7f857699604762268e3e3430ffc5c9c3868f6a1bc366279a11bd3` |
| `RingMap-ZeppOS-1.1.1-trex3-pro-10551552-10551553-10551555.zab` | 10551552, 10551553, 10551555 | `8e3fa5d6802933f74836c4504018a82eea0b48e40cde59288968a615d0d2aac0` |
| `RingMap-ZeppOS-1.1.1-gtr4-7930112-7930113.zab` | 7930112, 7930113 | `a99a178e50c71d78640a2283224880a5b38da855d4a533bdd8eef395ed81bd4b` |
| `RingMap-ZeppOS-1.1.1-gtr4-7864577.zab` | 7864577 | `cfd9181655dcd5a68c7c2cba44929d7ad971ae9a0c7ee9d48b1fb639c7207be7` |
| `RingMap-ZeppOS-1.1.1-trex3-8716544-8716545-8716547.zab` | 8716544, 8716545, 8716547 | `75421ad927ce06bbdf3a740c9f9883506c95b5ed02b281b683e5aa71b5258242` |

Android test companion artifact: `dist/RingMap-Android-Alpha-2-debug.apk`

| Field | Verified value |
| --- | --- |
| Package | `com.ringmap.nav` |
| Version | `Alpha-2` / code `13` |
| minSdk / targetSdk | `24` / `35` |
| SHA-256 | `c3fda4b7c5ed61b515ae9da20b51902e3740b2e71200c72630f275f3460cbdb7` |
| Signing | Android debug signing, signer SHA-256 `7cae0289da18c4c6182cdf07549523400c7363ac26aab582c832be58a4953ed9`; **internal test companion only, not a production-signed Android distribution artifact** |

## Submission Checklist

- [x] Run `npm run release:watch`; package manifests, SHA-256 values, version, and deviceSource coverage are recorded above.
- [x] Build Android companion `Alpha-2` / code `13`; validate package/version/minSdk/targetSdk and record its Debug APK SHA-256.
- [x] Confirm the Android companion's canonical source and repository mirror are identical immediately before the clean builds.
- [ ] Obtain a production Android signing configuration and distribution channel if the Android companion will be externally distributed beyond internal Alpha testing.
- [ ] Confirm Notification Access reports both granted and connected, then test a real Amap navigation step.
- [ ] Confirm a real Baidu Map navigation update changes on the watch.
- [ ] Wake the watch after at least three minutes screen-off and record the observed time plus Android `RingMapWS` correlation logs.
- [ ] Confirm the Android production diagnostic view/export contains no notification body, road, or raw instruction.
- [ ] Confirm the package has only the declared ZeppOS permissions and no credentials, API keys, or generated build leftovers.
- [ ] Obtain and retain written confirmation that Icons8 derivatives and owner-supplied artwork may be redistributed in the ZeppOS package, Android companion, store icon, and screenshots.
- [ ] Upload localized title, summary, description, privacy statement, supported-device selection, `docs/market-assets` PNGs, and the newly built `.zab` accepted by the Zepp developer console.
- [ ] Review the marketplace preview, current Console policies, data-security declaration, country/region, developer display name, and SDK declaration before pressing Submit.
