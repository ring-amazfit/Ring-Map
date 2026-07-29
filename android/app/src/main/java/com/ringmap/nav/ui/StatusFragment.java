package com.ringmap.nav.ui;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.ringmap.nav.MainActivity;
import com.ringmap.nav.NavStateViewModel;
import com.ringmap.nav.NavUiState;
import com.ringmap.nav.R;
import com.ringmap.nav.UiFormat;

public final class StatusFragment extends Fragment {

    private TextView badge;
    private TextView title;
    private TextView subtitle;
    private TextView permission;
    private TextView listener;
    private TextView service;
    private TextView watch;
    private TextView latest;
    private MaterialButton action;
    private NavUiState current;

    public StatusFragment() {
        super(R.layout.fragment_status);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        badge = view.findViewById(R.id.tvStatusBadge);
        title = view.findViewById(R.id.tvStatusTitle);
        subtitle = view.findViewById(R.id.tvStatusSubtitle);
        permission = view.findViewById(R.id.tvPermissionValue);
        listener = view.findViewById(R.id.tvListenerValue);
        service = view.findViewById(R.id.tvServiceValue);
        watch = view.findViewById(R.id.tvWatchValue);
        latest = view.findViewById(R.id.tvLatestEvent);
        action = view.findViewById(R.id.btnStatusAction);
        action.setOnClickListener(v -> activity().performReadinessAction(current));
        view.findViewById(R.id.btnOpenNavigation).setOnClickListener(v ->
                activity().openRootDestination(R.id.liveNavigationFragment));

        NavStateViewModel model = new ViewModelProvider(requireActivity())
                .get(NavStateViewModel.class);
        model.state().observe(getViewLifecycleOwner(), this::render);
    }

    private void render(NavUiState state) {
        if (state == null) return;
        current = state;
        permission.setText(state.notificationAccess ? "已授予" : "未授予");
        listener.setText(state.notificationAccess ? state.listenerState : "等待授权");
        service.setText(state.serviceRunning ? "运行中 · 127.0.0.1:8886"
                : (state.serviceError.isEmpty() ? state.serviceState : "异常 · " + state.serviceError));
        if (state.clientCount <= 0) {
            watch.setText("未检测到 App-Side 连接");
        } else if (state.lastAckAt <= 0L) {
            watch.setText("App-Side 已连接 · 等待手表 ACK");
        } else {
            String ack = "applied".equals(state.ackStatus) ? "控件已更新" : "已接收";
            watch.setText(ack + " · " + UiFormat.age(state.lastAckAt, state.now));
        }
        latest.setText(state.latestEvent.isEmpty() ? "暂无链路事件" : state.latestEvent);

        action.setVisibility(View.VISIBLE);
        action.setIconResource(R.drawable.ic_refresh_24);
        switch (state.readiness()) {
            case NEEDS_PERMISSION:
                badge.setText("需要处理");
                title.setText("允许通知使用权");
                subtitle.setText("未授权时，RingMap 不会读取任何导航数据。 ");
                action.setText("打开通知使用权");
                action.setIconResource(R.drawable.ic_notifications_24);
                break;
            case CONNECTING_LISTENER:
                badge.setText("正在恢复");
                title.setText("系统正在绑定监听");
                subtitle.setText("授权有效，正在等待系统建立真实监听连接。 ");
                action.setText("重新连接监听");
                break;
            case SERVICE_STOPPED:
                badge.setText("尚未运行");
                title.setText("启动后台同步");
                subtitle.setText("通知监听已就绪，同步服务需要在后台保持运行。 ");
                action.setText("启动同步服务");
                break;
            case SERVICE_ERROR:
                badge.setText("服务异常");
                title.setText("同步服务需要重启");
                subtitle.setText("本机导航桥没有正常监听 8886 端口。 ");
                action.setText("重启同步服务");
                break;
            case WAITING_BRIDGE:
                badge.setText("手机已就绪");
                title.setText("等待 Zepp App-Side");
                subtitle.setText("通知与后台服务正常，正在等待 Zepp 建立本机桥接。 ");
                action.setText("刷新链路");
                break;
            case WAITING_WATCH_ACK:
                badge.setText("桥接已连接");
                title.setText("等待手表确认");
                subtitle.setText("打开手表端 RingMap 后会收到当前最新快照。 ");
                action.setText("重新检查");
                break;
            case NAVIGATING:
                badge.setText("LIVE · #" + state.seq);
                title.setText("导航同步中");
                subtitle.setText(UiFormat.actionTitle(state.action) + " · "
                        + (state.distanceText.isEmpty() ? state.sourceName : state.distanceText));
                action.setVisibility(View.GONE);
                break;
            case READY:
            default:
                badge.setText("READY");
                title.setText("已准备就绪");
                subtitle.setText("开始高德或百度导航，下一步会自动同步到手表。 ");
                action.setVisibility(View.GONE);
                break;
        }
    }

    private MainActivity activity() {
        return (MainActivity) requireActivity();
    }
}
