package com.thaidy.forma;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutTimerPlugin.class);
        registerPlugin(FitideHealthPlugin.class);
        registerPlugin(NutritionReaderPlugin.class);
        super.onCreate(savedInstanceState);
        bridge.getWebView().getSettings().setSupportZoom(false);
        bridge.getWebView().getSettings().setBuiltInZoomControls(false);
        bridge.getWebView().getSettings().setDisplayZoomControls(false);
        hideNavigationBar();
    }

    private void hideNavigationBar() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.navigationBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideNavigationBar();
    }
}
