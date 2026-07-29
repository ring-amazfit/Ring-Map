package com.ringmap.nav.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import com.ringmap.nav.NavStateViewModel;
import com.ringmap.nav.NavUiState;
import com.ringmap.nav.R;
import com.ringmap.nav.UiFormat;

public final class LiveNavigationFragment extends Fragment {

    private View activeGroup;
    private View emptyGroup;
    private ImageView actionImage;
    private TextView source;
    private TextView distance;
    private TextView instruction;
    private TextView road;
    private TextView delivery;
    private TextView emptyTitle;
    private TextView emptyStatus;
    private TextView parseMetric;
    private TextView bridgeMetric;
    private TextView watchMetric;
    private TextView roundTripMetric;
    private TextView session;
    private long displayedSeq = -1L;

    public LiveNavigationFragment() {
        super(R.layout.fragment_live_navigation);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        activeGroup = view.findViewById(R.id.groupNavActive);
        emptyGroup = view.findViewById(R.id.groupNavEmpty);
        actionImage = view.findViewById(R.id.ivNavAction);
        source = view.findViewById(R.id.tvNavSource);
        distance = view.findViewById(R.id.tvNavDistance);
        instruction = view.findViewById(R.id.tvNavInstruction);
        road = view.findViewById(R.id.tvNavRoad);
        delivery = view.findViewById(R.id.tvNavDelivery);
        emptyTitle = view.findViewById(R.id.tvNavEmptyTitle);
        emptyStatus = view.findViewById(R.id.tvNavEmptyStatus);
        parseMetric = view.findViewById(R.id.tvMetricParse);
        bridgeMetric = view.findViewById(R.id.tvMetricBridge);
        watchMetric = view.findViewById(R.id.tvMetricWatch);
        roundTripMetric = view.findViewById(R.id.tvMetricRoundTrip);
        session = view.findViewById(R.id.tvNavSession);

        new ViewModelProvider(requireActivity()).get(NavStateViewModel.class)
                .state().observe(getViewLifecycleOwner(), this::render);
    }

    private void render(NavUiState state) {
        if (state == null) return;
        parseMetric.setText(UiFormat.metric(state.androidParseMs()));
        bridgeMetric.setText(UiFormat.metric(state.bridgeReceiveMs()));
        watchMetric.setText(UiFormat.metric(state.watchApplyMs()));
        roundTripMetric.setText(UiFormat.metric(state.ackRoundTripMs));
        session.setText("会话 " + UiFormat.shortSession(state.sessionId) + " · 序号 "
                + (state.seq > 0L ? state.seq : "—"));

        if (!state.navigating) {
            activeGroup.setVisibility(View.GONE);
            emptyGroup.setVisibility(View.VISIBLE);
            renderEmpty(state);
            displayedSeq = -1L;
            return;
        }

        activeGroup.setVisibility(View.VISIBLE);
        emptyGroup.setVisibility(View.GONE);
        source.setText((state.sourceName.isEmpty() ? "系统导航" : state.sourceName)
                + " · #" + state.seq);
        boolean showDirection = !"wait".equals(state.action);
        actionImage.setVisibility(showDirection ? View.VISIBLE : View.GONE);
        if (showDirection) {
            actionImage.setImageResource(UiFormat.actionIcon(state.action));
            actionImage.setContentDescription(UiFormat.actionTitle(state.action));
        }
        distance.setText(state.distanceText.isEmpty() ? "—" : state.distanceText);
        instruction.setText(state.instruction.isEmpty()
                ? UiFormat.actionTitle(state.action) : state.instruction);
        road.setText(state.road.isEmpty() ? UiFormat.actionTitle(state.action) : state.road);
        if (state.lastAckAt <= 0L || state.ackStatus.isEmpty()) {
            delivery.setText("等待手表确认 · " + UiFormat.age(state.emittedAt, state.now));
        } else if ("applied".equals(state.ackStatus)) {
            delivery.setText("手表控件已更新 · " + UiFormat.age(state.lastAckAt, state.now));
        } else {
            delivery.setText("手表已接收 · 等待控件更新");
        }

        if (displayedSeq != state.seq) {
            displayedSeq = state.seq;
            actionImage.setAlpha(0f);
            distance.setAlpha(0f);
            actionImage.animate().alpha(1f).setDuration(140L).start();
            distance.animate().alpha(1f).setDuration(140L).start();
        }
    }

    private void renderEmpty(NavUiState state) {
        switch (state.readiness()) {
            case NEEDS_PERMISSION:
                emptyTitle.setText("等待通知权限");
                emptyStatus.setText("请先在设置页允许通知使用权");
                break;
            case CONNECTING_LISTENER:
                emptyTitle.setText("正在连接监听");
                emptyStatus.setText("系统绑定完成后即可接收导航步骤");
                break;
            case WAITING_BRIDGE:
                emptyTitle.setText("等待 Zepp 桥接");
                emptyStatus.setText("手机服务已运行，正在等待 App-Side");
                break;
            case WAITING_WATCH_ACK:
                emptyTitle.setText("等待手表确认");
                emptyStatus.setText("打开手表端 RingMap 完成连接");
                break;
            default:
                emptyTitle.setText("等待系统导航");
                emptyStatus.setText("开始高德或百度导航后自动显示当前步骤");
                break;
        }
    }
}
