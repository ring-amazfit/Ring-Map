# RingMap 隐私声明 / Privacy Statement

最后更新：2026-07-30

RingMap 是一个 Android 配套的 Amazfit 手表导航提示应用。它将高德地图与百度地图的**系统导航通知**中的当前步骤同步到已连接的手表；它不是地图、定位、路线规划或导航服务。

## 我们不收集的内容

RingMap 不创建账号，也不要求或收集：

- 定位、路线历史或行程记录
- 通讯录、相机、麦克风、相册或健康数据
- 支付信息、广告标识符或分析遥测
- 地图 API Key、开发者服务器凭据

## 仅为同步而处理的数据

当你在 Android 系统设置中主动授予 RingMap“通知使用权”后，Android 配套端会瞬时读取高德地图和百度地图导航通知的标题、正文、大文本、子文本、摘要、信息文本和多行文本，以提取当前动作、距离、道路和来源。该信息只在以下本地链路中使用：

```text
Android 设备 -> 本机 127.0.0.1 WebSocket -> Zepp App-Side -> 已连接手表
```

RingMap 不将导航正文、路线、位置、诊断事件或手表设置上传到开发者服务器。Android 的 `INTERNET` 权限仅用于设备本机 `127.0.0.1:8886` 的桥接通信。

## 本地存储与保留

- 手表端会本地保存主题、显示、震动等偏好，以及用于息屏恢复的最近有效导航快照；快照过期后不应再用于显示方向。
- Android 端的诊断事件默认仅驻留于当前进程，用于显示当前连接和同步状态；诊断缓存、事件环与 Logcat 不记录通知正文、原始指令或道路名称。
- Android 不持久化导航通知正文，且已关闭 Android 自动备份（`allowBackup=false`）。
- 卸载 Android 应用后，应用私有数据由 Android 系统处理；卸载手表端应用时，其本地设置可由系统删除。

## 权限

ZeppOS 包声明的权限仅用于本地存储、与 Zepp App-Side 的网络通信和运行时设备信息。Android 配套端另会请求用户在系统中授予“通知使用权”；“增强连接”中的电池不限制也是由用户通过 Android 官方系统提示自主确认。

## 联系方式

如需了解此声明或报告问题，请通过项目仓库提出 issue：<https://github.com/ring-amazfit/Ring-Map>。

---

# Privacy Statement (English)

Last updated: 2026-07-30

RingMap is an Android companion app for Amazfit watches. It mirrors the current step from **Amap and Baidu Map system navigation notifications** to a connected watch. It is not a map, location, routing, or navigation service.

## Data we do not collect

RingMap does not create accounts and does not request or collect:

- Location, route history, or trip history
- Contacts, camera, microphone, photos, or health data
- Payment information, advertising identifiers, or analytics telemetry
- Map API keys or developer-server credentials

## Data processed only for local synchronization

After you explicitly grant Android Notification Access, the Android companion transiently reads title, text, big text, subtext, summary, info text, and text lines from Amap and Baidu Map system navigation notifications to derive the current maneuver, distance, road, and source. This information is used only in the following local path:

```text
Android device -> local 127.0.0.1 WebSocket -> Zepp App-Side -> connected watch
```

RingMap does not upload navigation text, routes, locations, diagnostic events, or watch settings to developer servers. The Android `INTERNET` permission is used only for the device-local bridge at `127.0.0.1:8886`.

## Local storage and retention

- The watch stores theme, display, and haptic preferences locally, together with the most recent valid navigation snapshot needed for wake recovery. An expired snapshot must not be used to render a maneuver.
- Android diagnostic events are kept in the current process by default for connection and synchronization status. RingMap diagnostics, event history, and Logcat do not retain notification text, raw instructions, or road names.
- Android does not persist navigation notification text and disables Android automatic backup (`allowBackup=false`).
- When the Android app is removed, Android handles private app data. Watch-local settings can be removed when the watch app is uninstalled.

## Permissions

The ZeppOS package declares permissions only for local storage, Zepp App-Side network communication, and runtime device information. The Android companion separately asks the user to grant Notification Access in Android Settings. Battery unrestricted mode in Enhanced connection is also an optional confirmation made by the user through the official Android system prompt.

## Contact

For questions about this policy or to report an issue, open an issue in the project repository: <https://github.com/ring-amazfit/Ring-Map>.
