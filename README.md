# RingMap — 环间导航

RingMap 由两个相互独立的工程组成：

- `D:\ring\RingMap`：ZeppOS 手表端
- `D:\ring\RingMap-android`：Android 配套端

## 当前数据链路

```text
高德地图在手机系统通知栏显示导航
→ Android NotificationListenerService 读取通知文本
→ 解析转向和距离
→ 手机本机 WebSocket 127.0.0.1:8886
→ ZeppOS App-Side
→ ZeppOS MessageBuilder / BLE
→ 手表显示
```

RingMap 不自行规划路线、不获取 GPS、不请求高德 Web API，也不包含高德地图、搜索、定位或导航 SDK。工程中不保存任何 API Key。

## 使用

1. 安装 Android 配套 App，授予「通知使用权」。
2. 在 Zepp App 保持手表连接，并打开手表端 RingMap 2.4.1。
3. 在手机高德地图中开始导航。
4. 手表导航页显示箭头、距离和下一步指令。

手机端前台服务负责保持本机 WebSocket 运行。手表端使用黑底高对比骑行导航界面，支持 Balance、GTR4、Cheetah Pro、Active2、T-Rex 3、T-Rex 3 Pro，持续亮屏开关只影响亮屏时长；无论开关是否开启，息屏唤醒后都会尽量恢复当前页面。

## 构建

### ZeppOS 手表端

```bash
cd D:/ring/RingMap
zeus build
zeus prune --ip
```

### Android 配套端

```bash
cd D:/ring/RingMap/android
export JAVA_HOME=/d/moondrop/tools/jdk-21.0.11+10
./gradlew.bat testDebugUnitTest assembleRelease
```

Android 端只需 WebSocket、AndroidX 和 Material 依赖；不需要高德 Key 或高德 SDK 下载包。
