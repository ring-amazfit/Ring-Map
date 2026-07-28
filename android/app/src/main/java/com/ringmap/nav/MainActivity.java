package com.ringmap.nav;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

/** 环间导航主界面：同步状态、链路状态、导航预览和诊断。 */
public class MainActivity extends AppCompatActivity {

    private static final String NAV_LISTENER_PKG = "com.ringmap.nav";

    private TextView tvHeroState, tvHeroDescription, tvListenerState,
            tvServiceState, tvWatchState, tvNavArrow, tvNavInstruction,
            tvNavDistance, tvNavSyncedAt, tvNavLive, tvDebug,
            tvNextStepTitle, tvNextStepDescription;
    private View groupNavEmpty, groupNavActive, cardPermission;
    private Button btnGrantPermission, btnHeroAction, btnNextStep;
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private boolean diagnosticsExpanded;
    private long lastRebindAttemptMs;
    private int rebindAttempts;

    private final Runnable statePoller = new Runnable() {
        @Override public void run() {
            renderState();
            uiHandler.postDelayed(this, 1500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        initViews();
        renderState();
    }

    private void initViews() {
        tvHeroState = findViewById(R.id.tvHeroState);
        tvHeroDescription = findViewById(R.id.tvHeroDescription);
        tvListenerState = findViewById(R.id.tvListenerState);
        tvServiceState = findViewById(R.id.tvServiceState);
        tvWatchState = findViewById(R.id.tvWatchState);
        tvNavArrow = findViewById(R.id.tvNavArrow);
        tvNavInstruction = findViewById(R.id.tvNavInstruction);
        tvNavDistance = findViewById(R.id.tvNavDistance);
        tvNavSyncedAt = findViewById(R.id.tvNavSyncedAt);
        tvNavLive = findViewById(R.id.tvNavLive);
        tvDebug = findViewById(R.id.tvDebug);
        tvNextStepTitle = findViewById(R.id.tvNextStepTitle);
        tvNextStepDescription = findViewById(R.id.tvNextStepDescription);
        groupNavEmpty = findViewById(R.id.groupNavEmpty);
        groupNavActive = findViewById(R.id.groupNavActive);
        cardPermission = findViewById(R.id.cardPermission);
        btnGrantPermission = findViewById(R.id.btnGrantPermission);
        btnHeroAction = findViewById(R.id.btnHeroAction);
        btnNextStep = findViewById(R.id.btnNextStep);

        btnGrantPermission.setOnClickListener(v -> openNotificationAccessSettings());
        btnHeroAction.setOnClickListener(v -> openNotificationAccessSettings());
        btnNextStep.setOnClickListener(v -> {
            if (!isNotificationAccessGranted()) openNotificationAccessSettings();
            else Toast.makeText(this, "请在手表打开“环间导航”，再在手机导航应用中开始导航", Toast.LENGTH_LONG).show();
        });
        findViewById(R.id.btnRefresh).setOnClickListener(v -> renderState());
        findViewById(R.id.btnToggleDiagnostics).setOnClickListener(v -> {
            diagnosticsExpanded = !diagnosticsExpanded;
            tvDebug.setVisibility(diagnosticsExpanded ? View.VISIBLE : View.GONE);
            ((Button) findViewById(R.id.btnToggleDiagnostics)).setText(diagnosticsExpanded ? "收起" : "展开");
        });
    }

    private boolean isNotificationAccessGranted() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && manager.isNotificationListenerAccessGranted(
                    new ComponentName(this, NavNotificationListener.class))) {
                return true;
            }
        }
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return NotificationAccess.isEnabled(enabled, NAV_LISTENER_PKG, "com.ringmap.nav.NavNotificationListener");
    }

    /**
     * 设置中显示已授权不代表系统已经绑定 Service。主动请求重绑，
     * 同时将真实结果留给 onListenerConnected/onListenerDisconnected 更新。
     */
    private void requestListenerRebindIfNeeded(boolean permissionGranted) {
        if (!permissionGranted || LastNavCache.isListenerConnected()) return;
        long now = System.currentTimeMillis();
        if (now - lastRebindAttemptMs < 3000L) return;
        lastRebindAttemptMs = now;
        rebindAttempts = Math.min(rebindAttempts + 1, 1000);
        try {
            LastNavCache.setDebug("[正在请求系统连接通知监听]");
            NotificationListenerService.requestRebind(
                    new ComponentName(this, NavNotificationListener.class));
        } catch (Exception e) {
            LastNavCache.setDebug("[请求监听重连失败] " + e.getClass().getSimpleName());
        }
    }

    private void renderState() {
        boolean permission = isNotificationAccessGranted();
        if (permission) {
            cardPermission.setVisibility(View.GONE);
            requestListenerRebindIfNeeded(true);
            if (!NavigationService.isRunning()) startNavigationService();
        } else {
            cardPermission.setVisibility(View.VISIBLE);
        }

        boolean listener = permission && LastNavCache.isListenerConnected();
        boolean service = NavigationService.isRunning();
        int clients = NavigationService.getClientCount();
        boolean watchConnected = clients > 0;
        long watchAckAge = LastNavCache.getLastWatchAckTs() <= 0
                ? Long.MAX_VALUE
                : System.currentTimeMillis() - LastNavCache.getLastWatchAckTs();
        JSONObject nav = LastNavCache.get();

        tvListenerState.setText(!permission ? "未授权" : LastNavCache.getListenerState());
        tvServiceState.setText(service ? "运行中 · 端口 8886" : NavigationService.getState());
        tvWatchState.setText(watchConnected
                ? (watchAckAge < 30000 ? "已连接并确认 · " + clients + " 个客户端" : "手表已连接，等待手表确认")
                : "未检测到手表端连接");

        if (!permission) {
            setHero("需要允许通知使用权", "允许后才能读取系统导航通知。", "前往授权", true);
            setNext("先完成通知授权", "环间导航只读取导航通知，用于把转向和距离同步到手表。", "前往授权", true);
        } else if (!listener) {
            setHero("正在连接通知监听", "通知使用权已确认；正在请求系统重新绑定，通常会在几秒内完成。", "检查授权", true);
            setNext("如果持续超过 10 秒", "到系统设置关闭后重新开启“环间导航”的通知使用权，再回到这里点刷新。", "打开系统设置", true);
        } else if (!service) {
            setHero("同步服务尚未启动", "手机端服务没有正常启动，手表端暂时无法连接。", "重新检查", false);
            setNext("检查手机后台限制", "请允许环间导航自启动、后台运行和电池不限制，返回桌面后同步仍会继续。", "打开应用设置", true);
            btnNextStep.setOnClickListener(v -> openBackgroundSettings());
        } else if (!watchConnected) {
            setHero("等待手表端连接", "手机同步服务已运行；返回桌面不会停止监听。请在 Zepp App 保持手表连接。", "", false);
            setNext("打开手表端应用", "手机服务已就绪；手表端连接后，这里会显示已检测到连接。", "查看连接说明", false);
        } else if (watchAckAge >= 30000) {
            setHero("等待手表确认", "手机端已连接，但手表还没有回传确认。请打开手表端 RingMap。", "", false);
            setNext("打开手表端应用", "只有收到手表确认后，导航数据才会被标记为已送达。", "查看连接说明", false);
        } else if (nav == null) {
            setHero("已准备就绪", "通知监听和手表链路都正常，开始导航即可同步。", "", false);
            setNext("开始导航即可同步", "在手机导航应用中开始导航，下一条转向会显示在这里。", "", false);
        } else {
            setHero("正在同步导航", "最新转向已发送到手表。", "", false);
            setNext("导航同步中", "保持手机导航和手表端应用可用，接近转弯时手表会震动。", "", false);
        }
        updateNavPreview(nav);
        updateDiagnostics();
    }

    private void setHero(String title, String description, String action, boolean showAction) {
        tvHeroState.setText(title);
        tvHeroDescription.setText(description);
        btnHeroAction.setText(action);
        btnHeroAction.setVisibility(showAction ? View.VISIBLE : View.GONE);
    }

    private void setNext(String title, String description, String action, boolean showAction) {
        tvNextStepTitle.setText(title);
        tvNextStepDescription.setText(description);
        btnNextStep.setText(action);
        btnNextStep.setVisibility(showAction ? View.VISIBLE : View.GONE);
    }

    private void updateNavPreview(JSONObject nav) {
        if (nav == null) {
            groupNavEmpty.setVisibility(View.VISIBLE);
            groupNavActive.setVisibility(View.GONE);
            tvNavLive.setText("等待中");
            return;
        }
        groupNavEmpty.setVisibility(View.GONE);
        groupNavActive.setVisibility(View.VISIBLE);
        tvNavLive.setText("实时");
        String action = nav.optString("action", "straight");
        tvNavArrow.setText(actionToArrow(action));
        tvNavInstruction.setText(nav.optString("instruction", action));
        String distance = nav.optString("distanceText", "");
        tvNavDistance.setText(distance.isEmpty() ? "—" : distance);
        long ts = nav.optLong("ts", LastNavCache.getLastParseSuccessTs());
        tvNavSyncedAt.setText("已发送至手表 · " + ageText(ts));
    }


    private void updateDiagnostics() {
        String debug = LastNavCache.getDebug();
        if (TextUtils.isEmpty(debug)) {
            tvDebug.setText("暂无监听事件");
            return;
        }
        tvDebug.setText("授权：" + (isNotificationAccessGranted() ? "已授予" : "未授予")
                + "\n监听：" + LastNavCache.getListenerState()
                + "\n手表端：" + (NavigationService.getClientCount() > 0 ? "已连接" : "未连接")
                + "\n最近事件：" + ageText(LastNavCache.getDebugTs())
                + "\n原始信息：" + debug);
    }

    private String ageText(long timestamp) {
        if (timestamp <= 0) return "等待中";
        long seconds = Math.max(0, (System.currentTimeMillis() - timestamp) / 1000);
        if (seconds < 5) return "刚刚";
        if (seconds < 60) return seconds + " 秒前";
        return (seconds / 60) + " 分钟前";
    }

    private void startNavigationService() {
        try {
            ContextCompat.startForegroundService(this, new Intent(this, NavigationService.class));
        } catch (Exception ignored) {
            // renderState 会显示真实的服务状态，避免用 Toast 掩盖后台启动限制。
        }
    }

    private void openBackgroundSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(android.net.Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "请在系统设置允许环间导航自启动、后台运行和电池不限制", Toast.LENGTH_LONG).show();
        }
    }

    private void openNotificationAccessSettings() {
        Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            fallback.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(fallback);
        }
    }

    // RingMap 不获取定位；导航位置由手机导航通知写入后再由监听服务读取。

    private String actionToArrow(String action) {
        if (action == null) return "↑";
        switch (action) {
            case "left": case "slight_left": return "↖";
            case "right": case "slight_right": return "↗";
            case "uturn": return "↓";
            case "arrive": return "✓";
            default: return "↑";
        }
    }

    @Override protected void onResume() {
        super.onResume();
        uiHandler.removeCallbacks(statePoller);
        renderState();
        uiHandler.post(statePoller);
    }

    @Override protected void onPause() {
        super.onPause();
        uiHandler.removeCallbacks(statePoller);
    }
}
