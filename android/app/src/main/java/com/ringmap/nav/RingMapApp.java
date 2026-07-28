package com.ringmap.nav;

import android.app.Application;
import android.util.Log;

import com.google.android.material.color.DynamicColors;

/** RingMap 应用入口：只负责主题初始化，不初始化任何地图或网络 API SDK。 */
public class RingMapApp extends Application {

    private static final String TAG = "RingMapApp";

    @Override
    public void onCreate() {
        super.onCreate();
        DynamicColors.applyToActivitiesIfAvailable(this);
        // Android 12+ 使用系统壁纸生成的 Monet 动态颜色；低版本使用 XML fallback。
        Log.d(TAG, "RingMapApp onCreate");
    }
}
