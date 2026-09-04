package com.thaidy.forma;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

public class WorkoutTimerService extends Service {
    public static final String ACTION_START = "com.thaidy.forma.timer.START";
    public static final String ACTION_PAUSE = "com.thaidy.forma.timer.PAUSE";
    public static final String ACTION_RESUME = "com.thaidy.forma.timer.RESUME";
    public static final String ACTION_SKIP = "com.thaidy.forma.timer.SKIP";
    public static final String ACTION_STOP = "com.thaidy.forma.timer.STOP";
    private static final String CHANNEL_ID = "fitide_workout_timer";
    private static final int NOTIFICATION_ID = 2101;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean running;
    private boolean freeMode;
    private boolean restPhase;
    private int workSeconds = 120;
    private int restSeconds = 60;
    private int rounds = 7;
    private int round = 1;
    private int remaining = 120;
    private int elapsed = 0;
    private String timerName = "Treino Fitide";

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (running) {
                if (freeMode) elapsed += 1;
                else if (remaining > 1) remaining -= 1;
                else advancePhase();
                updateNotification();
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Cronómetro de treino", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém o cronómetro Fitide visível durante o treino.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
        handler.postDelayed(ticker, 1000);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_START.equals(action)) {
            timerName = intent.getStringExtra("name");
            if (timerName == null || timerName.isEmpty()) timerName = "Treino Fitide";
            freeMode = "free".equals(intent.getStringExtra("mode"));
            workSeconds = Math.max(1, intent.getIntExtra("workSeconds", 120));
            restSeconds = Math.max(0, intent.getIntExtra("restSeconds", 60));
            rounds = Math.max(1, intent.getIntExtra("rounds", 7));
            round = 1; elapsed = 0; restPhase = false; remaining = workSeconds; running = true;
            int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type);
        } else if (ACTION_PAUSE.equals(action)) {
            running = false; updateNotification();
        } else if (ACTION_RESUME.equals(action)) {
            running = true; updateNotification();
        } else if (ACTION_SKIP.equals(action)) {
            advancePhase(); updateNotification();
        } else if (ACTION_STOP.equals(action)) {
            stopTimer();
        }
        return START_NOT_STICKY;
    }

    private void advancePhase() {
        if (freeMode) return;
        if (restPhase) {
            round += 1; restPhase = false; remaining = workSeconds;
        } else if (round >= rounds) {
            running = false; remaining = 0; updateNotification();
        } else if (restSeconds > 0) {
            restPhase = true; remaining = restSeconds;
        } else {
            round += 1; remaining = workSeconds;
        }
    }

    private String clock(int seconds) {
        return String.format(java.util.Locale.ROOT, "%02d:%02d", seconds / 60, seconds % 60);
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openApp, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stopIntent = new Intent(this, WorkoutTimerService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String phase = freeMode ? "Treino livre" : remaining == 0 ? "Concluído" : restPhase ? "Descanso" : "Trabalho";
        String detail = freeMode ? clock(elapsed) : clock(remaining) + " · ronda " + round + "/" + rounds;
        if (!running && remaining > 0) detail += " · pausado";
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(timerName + " — " + phase)
            .setContentText(detail)
            .setContentIntent(contentIntent)
            .setOngoing(running)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .addAction(0, "Terminar", stopPending)
            .build();
    }

    private void updateNotification() {
        try { NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildNotification()); } catch (SecurityException ignored) {}
    }

    private void stopTimer() {
        running = false;
        handler.removeCallbacks(ticker);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() { handler.removeCallbacks(ticker); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
