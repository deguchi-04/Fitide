package com.thaidy.forma;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WorkoutTimer")
public class WorkoutTimerPlugin extends Plugin {
    private void send(String action) {
        Intent intent = new Intent(getContext(), WorkoutTimerService.class);
        intent.setAction(action);
        if (WorkoutTimerService.ACTION_START.equals(action)) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 8124);
        }
        Intent intent = new Intent(getContext(), WorkoutTimerService.class);
        intent.setAction(WorkoutTimerService.ACTION_START);
        intent.putExtra("name", call.getString("name", "Treino Fitide"));
        intent.putExtra("mode", call.getString("mode", "interval"));
        intent.putExtra("workSeconds", call.getInt("workSeconds", 120));
        intent.putExtra("restSeconds", call.getInt("restSeconds", 60));
        intent.putExtra("rounds", call.getInt("rounds", 7));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve(new JSObject());
    }

    @PluginMethod public void pause(PluginCall call) { send(WorkoutTimerService.ACTION_PAUSE); call.resolve(); }
    @PluginMethod public void resume(PluginCall call) { send(WorkoutTimerService.ACTION_RESUME); call.resolve(); }
    @PluginMethod public void skip(PluginCall call) { send(WorkoutTimerService.ACTION_SKIP); call.resolve(); }
    @PluginMethod public void stop(PluginCall call) { send(WorkoutTimerService.ACTION_STOP); call.resolve(); }
}
