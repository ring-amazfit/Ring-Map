package com.ringmap.nav.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.ringmap.nav.MainActivity;
import com.ringmap.nav.NavStateViewModel;
import com.ringmap.nav.NavUiState;
import com.ringmap.nav.R;

public final class SettingsFragment extends Fragment {

    private TextView notificationValue;
    private TextView connectionProtectionValue;

    public SettingsFragment() {
        super(R.layout.fragment_settings);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        notificationValue = view.findViewById(R.id.tvNotificationAccessValue);
        connectionProtectionValue = view.findViewById(R.id.tvConnectionProtectionValue);
        MainActivity activity = (MainActivity) requireActivity();
        view.findViewById(R.id.rowNotificationAccess)
                .setOnClickListener(v -> activity.openNotificationAccessSettings());
        view.findViewById(R.id.rowConnectionProtection)
                .setOnClickListener(v -> activity.showConnectionProtection());
        view.findViewById(R.id.rowBackgroundAccess)
                .setOnClickListener(v -> activity.openBackgroundSettings());
        view.findViewById(R.id.rowSources).setOnClickListener(v -> showSources());
        view.findViewById(R.id.rowPrivacy).setOnClickListener(v -> showPrivacy());
        view.findViewById(R.id.rowAbout).setOnClickListener(v -> activity.openAbout());

        new ViewModelProvider(requireActivity()).get(NavStateViewModel.class)
                .state().observe(getViewLifecycleOwner(), this::render);
    }

    private void render(NavUiState state) {
        if (state == null) return;
        notificationValue.setText(state.notificationAccess
                ? (state.listenerConnected ? "已授权 · 监听已连接" : "已授权 · 正在连接监听")
                : "未授权");
        connectionProtectionValue.setText(((MainActivity) requireActivity())
                .isIgnoringBatteryOptimizations() ? "已启用 · 电池不限制" : "建议启用 · 降低后台中断");
    }

    private void showSources() {
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle("支持的导航来源")
                .setMessage("高德地图\n百度地图\n\nRingMap 读取两者的系统导航常驻通知，不调用地图 SDK 或 Web API。")
                .setPositiveButton("知道了", null)
                .show();
    }

    private void showPrivacy() {
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle("隐私与联网")
                .setMessage("不申请定位权限\n不保存地图 API Key\n不上传导航正文\n诊断事件仅驻留在当前进程，并默认不记录路名。")
                .setPositiveButton("知道了", null)
                .show();
    }
}
