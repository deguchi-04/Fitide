package com.thaidy.forma;

        bridge.getWebView().getSettings().setSupportZoom(false);
        bridge.getWebView().getSettings().setBuiltInZoomControls(false);
        bridge.getWebView().getSettings().setDisplayZoomControls(false);
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutTimerPlugin.class);
        registerPlugin(FitideHealthPlugin.class);
        registerPlugin(NutritionReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
