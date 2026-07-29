package com.ringmap.nav.ui;

import android.os.Bundle;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.transition.MaterialSharedAxis;
import com.ringmap.nav.MainActivity;
import com.ringmap.nav.R;

public final class AboutFragment extends Fragment {

    public AboutFragment() {
        super(R.layout.fragment_about);
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setEnterTransition(new MaterialSharedAxis(MaterialSharedAxis.X, true));
        setReturnTransition(new MaterialSharedAxis(MaterialSharedAxis.X, false));
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        MainActivity activity = (MainActivity) requireActivity();
        MaterialToolbar toolbar = view.findViewById(R.id.aboutToolbar);
        toolbar.setNavigationOnClickListener(v -> activity.closeDetail());
        view.findViewById(R.id.btnOpenGithub).setOnClickListener(v -> activity.openGithub());
        view.findViewById(R.id.btnOpenIcons8).setOnClickListener(v -> activity.openIcons8());
    }
}
