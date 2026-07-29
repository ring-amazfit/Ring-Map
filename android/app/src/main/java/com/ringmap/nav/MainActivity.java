package com.ringmap.nav;

import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;
import androidx.lifecycle.Lifecycle;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.shape.ShapeAppearanceModel;
import com.ringmap.nav.ui.AboutFragment;
import com.ringmap.nav.ui.DiagnosticsFragment;
import com.ringmap.nav.ui.LiveNavigationFragment;
import com.ringmap.nav.ui.SettingsFragment;
import com.ringmap.nav.ui.StatusFragment;

/** 多页面导航宿主；业务状态统一来自 NavStateRepository。 */
public class MainActivity extends AppCompatActivity {

    public static final String GITHUB_URL = "https://github.com/ring-amazfit/Ring-Map";
    public static final String ICONS8_URL = "https://icons8.com/";
    private static final String NAV_LISTENER_PKG = "com.ringmap.nav";
    private static final String STATE_ROOT_INDEX = "root_destination_index";
    private static final String DETAIL_BACK_STACK = "detail";
    private static final String[] ROOT_TAGS = {
            "root:status", "root:navigation", "root:diagnostics", "root:settings"
    };

    private final Handler ageHandler = new Handler(Looper.getMainLooper());
    private final Handler pageHandler = new Handler(Looper.getMainLooper());
    private final NavStateRepository repository = NavStateRepository.get();
    private long lastRebindAttemptMs;
    private BottomNavigationView bottomNavigation;
    private int currentRootIndex;
    private boolean detailOpening;
    private final Runnable ageTicker = new Runnable() {
        @Override public void run() {
            repository.tick(System.currentTimeMillis());
            ageHandler.postDelayed(this, 1000L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        setContentView(R.layout.activity_main);
        setupInsets();
        setupNavigation(savedInstanceState);
        refreshInfrastructure();
    }

    private void setupInsets() {
        View root = findViewById(R.id.rootCoordinator);
        bottomNavigation = findViewById(R.id.bottomNavigation);
        int baseNavigationHeight = dp(80);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets system = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(0, system.top, 0, 0);
            ViewGroup.LayoutParams params = bottomNavigation.getLayoutParams();
            params.height = baseNavigationHeight + system.bottom;
            bottomNavigation.setLayoutParams(params);
            bottomNavigation.setPadding(0, 0, 0, system.bottom);
            boolean dark = (getResources().getConfiguration().uiMode
                    & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), view);
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);
            return insets;
        });
    }

    private void setupNavigation(Bundle savedInstanceState) {
        bottomNavigation.setItemActiveIndicatorEnabled(true);
        bottomNavigation.setItemActiveIndicatorWidth(dp(64));
        bottomNavigation.setItemActiveIndicatorHeight(dp(32));
        bottomNavigation.setItemActiveIndicatorMarginHorizontal(dp(4));
        bottomNavigation.setItemActiveIndicatorColor(ContextCompat.getColorStateList(this,
                R.color.md3_secondary_container));
        bottomNavigation.setItemActiveIndicatorShapeAppearance(
                ShapeAppearanceModel.builder().setAllCornerSizes(dp(16)).build());
        bottomNavigation.setItemIconSize(dp(24));
        bottomNavigation.setItemIconTintList(ContextCompat.getColorStateList(this,
                R.color.bottom_nav_icon_colors));
        bottomNavigation.setItemTextColor(ContextCompat.getColorStateList(this,
                R.color.bottom_nav_text_colors));
        bottomNavigation.setItemTextAppearanceActiveBoldEnabled(true);
        bottomNavigation.setElevation(0f);

        currentRootIndex = savedInstanceState == null ? 0
                : savedInstanceState.getInt(STATE_ROOT_INDEX, 0);
        currentRootIndex = Math.max(0, Math.min(ROOT_TAGS.length - 1, currentRootIndex));
        restoreRootFragments();
        bottomNavigation.getMenu().findItem(destinationId(currentRootIndex)).setChecked(true);
        bottomNavigation.setOnItemSelectedListener(item ->
                showRootDestination(destinationIndex(item.getItemId())));

        FragmentManager fragments = getSupportFragmentManager();
        fragments.addOnBackStackChangedListener(() -> {
            detailOpening = false;
            setBottomNavigationVisible(fragments.getBackStackEntryCount() == 0);
        });
        if (fragments.getBackStackEntryCount() > 0) {
            bottomNavigation.setVisibility(View.GONE);
        } else {
            pageHandler.postDelayed(() -> preloadRootFragment(0), 120L);
        }
    }

    private void restoreRootFragments() {
        FragmentManager fragments = getSupportFragmentManager();
        Fragment current = fragments.findFragmentByTag(ROOT_TAGS[currentRootIndex]);
        if (current == null) {
            current = createRootFragment(currentRootIndex);
            fragments.beginTransaction()
                    .setReorderingAllowed(true)
                    .add(R.id.rootPageHost, current, ROOT_TAGS[currentRootIndex])
                    .setMaxLifecycle(current, Lifecycle.State.RESUMED)
                    .commitNow();
        }
        if (fragments.getBackStackEntryCount() > 0) return;

        androidx.fragment.app.FragmentTransaction transaction = fragments.beginTransaction()
                .setReorderingAllowed(true);
        for (int index = 0; index < ROOT_TAGS.length; index++) {
            Fragment root = fragments.findFragmentByTag(ROOT_TAGS[index]);
            if (root == null) continue;
            if (index == currentRootIndex) {
                transaction.show(root).setMaxLifecycle(root, Lifecycle.State.RESUMED);
            } else {
                transaction.hide(root).setMaxLifecycle(root, Lifecycle.State.STARTED);
            }
        }
        transaction.commitNow();
    }

    private boolean showRootDestination(int index) {
        FragmentManager fragments = getSupportFragmentManager();
        if (index < 0 || index >= ROOT_TAGS.length || fragments.isStateSaved()
                || fragments.getBackStackEntryCount() > 0) return false;
        Fragment target = fragments.findFragmentByTag(ROOT_TAGS[index]);
        Fragment current = fragments.findFragmentByTag(ROOT_TAGS[currentRootIndex]);
        if (index == currentRootIndex && target != null && !target.isHidden()) return true;

        androidx.fragment.app.FragmentTransaction transaction = fragments.beginTransaction()
                .setReorderingAllowed(true);
        if (current != null) {
            transaction.hide(current).setMaxLifecycle(current, Lifecycle.State.STARTED);
        }
        if (target == null) {
            target = createRootFragment(index);
            transaction.add(R.id.rootPageHost, target, ROOT_TAGS[index]);
        } else {
            transaction.show(target);
        }
        transaction.setMaxLifecycle(target, Lifecycle.State.RESUMED).commitNow();
        currentRootIndex = index;
        return true;
    }

    private void preloadRootFragment(int index) {
        if (index >= ROOT_TAGS.length) return;
        FragmentManager fragments = getSupportFragmentManager();
        if (!isFinishing() && !fragments.isStateSaved()
                && fragments.getBackStackEntryCount() == 0
                && fragments.findFragmentByTag(ROOT_TAGS[index]) == null) {
            Fragment root = createRootFragment(index);
            fragments.beginTransaction()
                    .setReorderingAllowed(true)
                    .add(R.id.rootPageHost, root, ROOT_TAGS[index])
                    .hide(root)
                    .setMaxLifecycle(root, Lifecycle.State.STARTED)
                    .commitNow();
        }
        pageHandler.postDelayed(() -> preloadRootFragment(index + 1), 120L);
    }

    private Fragment createRootFragment(int index) {
        if (index == 1) return new LiveNavigationFragment();
        if (index == 2) return new DiagnosticsFragment();
        if (index == 3) return new SettingsFragment();
        return new StatusFragment();
    }

    private int destinationIndex(int destinationId) {
        if (destinationId == R.id.liveNavigationFragment) return 1;
        if (destinationId == R.id.diagnosticsFragment) return 2;
        if (destinationId == R.id.settingsFragment) return 3;
        return 0;
    }

    private int destinationId(int index) {
        if (index == 1) return R.id.liveNavigationFragment;
        if (index == 2) return R.id.diagnosticsFragment;
        if (index == 3) return R.id.settingsFragment;
        return R.id.statusFragment;
    }

    private void setBottomNavigationVisible(boolean visible) {
        bottomNavigation.animate().cancel();
        if (visible) {
            boolean wasGone = bottomNavigation.getVisibility() != View.VISIBLE;
            bottomNavigation.setVisibility(View.VISIBLE);
            if (wasGone) {
                bottomNavigation.setAlpha(0f);
                bottomNavigation.setTranslationY(dp(16));
            }
            bottomNavigation.animate().alpha(1f).translationY(0f).setDuration(180L).start();
        } else {
            if (bottomNavigation.getVisibility() != View.VISIBLE) return;
            bottomNavigation.animate().alpha(0f).translationY(dp(16)).setDuration(140L)
                    .withEndAction(() -> bottomNavigation.setVisibility(View.GONE)).start();
        }
    }

    public void refreshInfrastructure() {
        boolean permission = isNotificationAccessGranted();
        repository.setNotificationAccess(permission);
        repository.setListenerState(permission && LastNavCache.isListenerConnected(),
                permission ? LastNavCache.getListenerState() : "未授权");
        repository.setServiceState(NavigationService.isRunning(), NavigationService.getState(),
                NavigationService.getError());
        repository.setClientCount(NavigationService.getClientCount());
        if (permission) {
            requestListenerRebind();
            startNavigationService();
        }
    }

    public void performReadinessAction(NavUiState state) {
        if (state == null) return;
        switch (state.readiness()) {
            case NEEDS_PERMISSION:
                openNotificationAccessSettings();
                break;
            case CONNECTING_LISTENER:
                requestListenerRebind();
                showToast("已请求系统重新连接通知监听");
                break;
            case SERVICE_STOPPED:
            case SERVICE_ERROR:
                startNavigationService();
                showToast("正在启动同步服务");
                break;
            default:
                refreshInfrastructure();
                showToast("链路状态已刷新");
                break;
        }
    }

    public boolean isNotificationAccessGranted() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && manager.isNotificationListenerAccessGranted(
                    new ComponentName(this, NavNotificationListener.class))) return true;
        }
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return NotificationAccess.isEnabled(enabled, NAV_LISTENER_PKG,
                "com.ringmap.nav.NavNotificationListener");
    }

    public void requestListenerRebind() {
        if (!isNotificationAccessGranted() || LastNavCache.isListenerConnected()) return;
        long now = System.currentTimeMillis();
        if (now - lastRebindAttemptMs < 3000L) return;
        lastRebindAttemptMs = now;
        try {
            repository.record("监听", "已请求系统重新绑定");
            NotificationListenerService.requestRebind(
                    new ComponentName(this, NavNotificationListener.class));
        } catch (Exception error) {
            repository.record("监听", "系统重绑请求失败");
        }
    }

    public void startNavigationService() {
        if (NavigationService.isRunning()) return;
        try {
            ContextCompat.startForegroundService(this, new Intent(this, NavigationService.class));
        } catch (Exception error) {
            repository.record("服务", "前台同步服务启动失败");
        }
    }

    public void openNotificationAccessSettings() {
        Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        try {
            startActivity(intent);
        } catch (Exception error) {
            Intent fallback = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            fallback.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(fallback);
        }
    }

    public void openBackgroundSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception error) {
            showToast("请在系统设置允许自启动、后台运行和电池不限制");
        }
    }

    public void copyDiagnostics() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard == null) return;
        clipboard.setPrimaryClip(ClipData.newPlainText("RingMap diagnostics",
                repository.diagnosticsText()));
        showToast("脱敏诊断已复制");
    }

    public void openGithub() {
        openUrl(GITHUB_URL);
    }

    public void openIcons8() {
        openUrl(ICONS8_URL);
    }

    private void openUrl(String value) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(value)));
        } catch (Exception error) {
            showToast("没有可打开链接的应用");
        }
    }

    public void showToast(String value) {
        Toast.makeText(this, value, Toast.LENGTH_SHORT).show();
    }

    public void openRootDestination(int destinationId) {
        bottomNavigation.setSelectedItemId(destinationId);
    }

    public void openAbout() {
        FragmentManager fragments = getSupportFragmentManager();
        if (detailOpening || fragments.isStateSaved()
                || fragments.getBackStackEntryCount() > 0) return;
        Fragment current = fragments.findFragmentByTag(ROOT_TAGS[currentRootIndex]);
        if (current == null) return;
        detailOpening = true;
        try {
            AboutFragment about = new AboutFragment();
            fragments.beginTransaction()
                    .setReorderingAllowed(true)
                    .hide(current)
                    .setMaxLifecycle(current, Lifecycle.State.STARTED)
                    .add(R.id.rootPageHost, about, "detail:about")
                    .addToBackStack(DETAIL_BACK_STACK)
                    .commit();
            setBottomNavigationVisible(false);
        } catch (RuntimeException error) {
            detailOpening = false;
            throw error;
        }
    }

    public void closeDetail() {
        getSupportFragmentManager().popBackStack();
    }

    @Override
    public boolean onSupportNavigateUp() {
        if (getSupportFragmentManager().getBackStackEntryCount() > 0) {
            closeDetail();
            return true;
        }
        return super.onSupportNavigateUp();
    }

    @Override
    protected void onSaveInstanceState(@androidx.annotation.NonNull Bundle outState) {
        outState.putInt(STATE_ROOT_INDEX, currentRootIndex);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshInfrastructure();
        ageHandler.removeCallbacks(ageTicker);
        ageHandler.post(ageTicker);
    }

    @Override
    protected void onPause() {
        ageHandler.removeCallbacks(ageTicker);
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        pageHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
