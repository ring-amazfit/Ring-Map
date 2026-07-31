package com.ringmap.nav.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.transition.MaterialSharedAxis;
import com.ringmap.nav.BuildConfig;
import com.ringmap.nav.MainActivity;
import com.ringmap.nav.R;
import com.ringmap.nav.update.GitHubRelease;
import com.ringmap.nav.update.GitHubUpdateChecker;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
        view.findViewById(R.id.btnCheckGithubUpdate).setOnClickListener(v -> checkGitHubUpdate(v));
        view.findViewById(R.id.btnOpenIcons8).setOnClickListener(v -> activity.openIcons8());
    }

    private void checkGitHubUpdate(View button) {
        button.setEnabled(false);
        Toast.makeText(requireContext(), "正在检查 GitHub 更新", Toast.LENGTH_SHORT).show();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                GitHubRelease release = GitHubUpdateChecker.fetchLatest();
                requireActivity().runOnUiThread(() -> showRelease(release));
            } catch (GitHubUpdateChecker.NoReleaseException error) {
                requireActivity().runOnUiThread(() -> new MaterialAlertDialogBuilder(requireContext())
                        .setTitle("暂未发布 GitHub Release")
                        .setMessage("仓库尚未创建正式 Release。你可以打开 Releases 页面查看构建或后续发布。")
                        .setNegativeButton("取消", null)
                        .setPositiveButton("打开 Releases", (dialog, which) -> openUrl(MainActivity.GITHUB_RELEASES_URL))
                        .show());
            } catch (Exception error) {
                requireActivity().runOnUiThread(() -> new MaterialAlertDialogBuilder(requireContext())
                        .setTitle("检查更新失败")
                        .setMessage("无法连接 GitHub，请检查网络后重试。\n\n" + error.getMessage())
                        .setPositiveButton("知道了", null)
                        .show());
            } finally {
                executor.shutdown();
                if (isAdded()) requireActivity().runOnUiThread(() -> button.setEnabled(true));
            }
        });
    }

    private void showRelease(GitHubRelease release) {
        boolean newer = GitHubUpdateChecker.isNewer(BuildConfig.VERSION_NAME, release.tagName);
        String message = "当前版本：" + BuildConfig.VERSION_NAME + "\n最新版本：" + release.tagName
                + "\n\n" + release.body;
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle(newer ? "发现新版本" : "已是最新版本")
                .setMessage(message)
                .setNegativeButton("取消", null)
                .setPositiveButton(release.apkUrl == null ? "查看 Release" : "下载 APK", (dialog, which) ->
                        openUrl(release.apkUrl == null ? release.htmlUrl : release.apkUrl))
                .show();
    }

    private void openUrl(String url) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    }
}
