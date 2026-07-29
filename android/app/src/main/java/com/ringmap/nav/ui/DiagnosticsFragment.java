package com.ringmap.nav.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.appbar.MaterialToolbar;
import com.ringmap.nav.MainActivity;
import com.ringmap.nav.NavStateRepository;
import com.ringmap.nav.NavStateViewModel;
import com.ringmap.nav.NavUiState;
import com.ringmap.nav.R;
import com.ringmap.nav.UiFormat;

public final class DiagnosticsFragment extends Fragment {

    private final DiagnosticsAdapter adapter = new DiagnosticsAdapter();
    private TextView clients;
    private TextView ack;
    private TextView latest;
    private TextView empty;

    public DiagnosticsFragment() {
        super(R.layout.fragment_diagnostics);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        clients = view.findViewById(R.id.tvDiagnosticClients);
        ack = view.findViewById(R.id.tvDiagnosticAck);
        latest = view.findViewById(R.id.tvDiagnosticLatest);
        empty = view.findViewById(R.id.tvDiagnosticsEmpty);
        RecyclerView recycler = view.findViewById(R.id.recyclerDiagnostics);
        recycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        recycler.setAdapter(adapter);

        MaterialToolbar toolbar = view.findViewById(R.id.diagnosticsToolbar);
        toolbar.setOnMenuItemClickListener(item -> {
            MainActivity activity = (MainActivity) requireActivity();
            if (item.getItemId() == R.id.action_refresh) {
                activity.refreshInfrastructure();
                activity.showToast("诊断状态已刷新");
                return true;
            }
            if (item.getItemId() == R.id.action_copy) {
                activity.copyDiagnostics();
                return true;
            }
            if (item.getItemId() == R.id.action_clear) {
                NavStateRepository.get().clearEvents();
                return true;
            }
            return false;
        });

        new ViewModelProvider(requireActivity()).get(NavStateViewModel.class)
                .state().observe(getViewLifecycleOwner(), this::render);
    }

    private void render(NavUiState state) {
        if (state == null) return;
        clients.setText(String.valueOf(state.clientCount));
        ack.setText(state.lastAckAt <= 0L ? "尚未收到"
                : state.ackStatus + " · " + UiFormat.age(state.lastAckAt, state.now));
        latest.setText(state.latestEvent.isEmpty() ? "暂无事件" : state.latestEvent);
        adapter.submit(state.events);
        empty.setVisibility(state.events.isEmpty() ? View.VISIBLE : View.GONE);
    }
}
