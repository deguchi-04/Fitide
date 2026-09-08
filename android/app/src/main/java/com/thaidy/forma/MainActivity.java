package com.thaidy.forma;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutTimerPlugin.class);
        registerPlugin(FitideHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
