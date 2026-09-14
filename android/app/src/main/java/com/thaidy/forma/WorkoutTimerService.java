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
import android.os.SystemClock;
import android.os.PowerManager;
import android.media.AudioManager;
import android.media.ToneGenerator;

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
    private static final String ALERT_CHANNEL_ID = "fitide_workout_timer_finished_v2";
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
    private long lastTick;
    private PowerManager.WakeLock wakeLock;

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (running) {
                long now = SystemClock.elapsedRealtime();
                int seconds = (int) ((now - lastTick) / 1000);
                lastTick += seconds * 1000L;
                if (freeMode) elapsed += seconds;
                else {
                    while (seconds > 0 && running) {
                        if (seconds < remaining) { remaining -= seconds; seconds = 0; }
                        else { seconds -= remaining; advancePhase(); }
                    }
                }
                updateNotification();
                if (!running && !freeMode && remaining == 0) {
                    finishServiceKeepingNotification();
                    return;
                }
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Cronómetro de treino", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém o cronómetro Fitide visível durante o treino.");
        NotificationChannel alertChannel = new NotificationChannel(ALERT_CHANNEL_ID, "Fim dos timers", NotificationManager.IMPORTANCE_HIGH);
        alertChannel.setDescription("Avisa com som e vibração quando um timer Fitide termina.");
        alertChannel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
        manager.createNotificationChannel(alertChannel);
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
            lastTick = SystemClock.elapsedRealtime();
            holdCpu();
            int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type);
        } else if (ACTION_PAUSE.equals(action)) {
            running = false; releaseCpu(); updateNotification();
        } else if (ACTION_RESUME.equals(action)) {
            running = true; lastTick = SystemClock.elapsedRealtime(); holdCpu(); updateNotification();
        } else if (ACTION_SKIP.equals(action)) {
            advancePhase(); updateNotification();
            if (!running && !freeMode && remaining == 0) finishServiceKeepingNotification();
        } else if (ACTION_STOP.equals(action)) {
            stopTimer();
        }
        return START_NOT_STICKY;
    }

    private void advancePhase() {
        if (freeMode) return;
        // Explicit alarm audio: an ongoing notification may not sound again.
        try {
            ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_ALARM, 90);
            tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1200);
            new Handler(Looper.getMainLooper()).postDelayed(tone::release, 1500);
        } catch (RuntimeException ignored) { /* The notification remains available. */ }
        if (restPhase) {
            round += 1; restPhase = false; remaining = workSeconds;
        } else if (round >= rounds) {
            running = false; remaining = 0;
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
        boolean completed = !freeMode && remaining == 0;
        return new NotificationCompat.Builder(this, completed ? ALERT_CHANNEL_ID : CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(timerName + " — " + phase)
            .setContentText(detail)
            .setContentIntent(contentIntent)
            .setOngoing(running)
            .setAutoCancel(completed)
            .setOnlyAlertOnce(!completed)
            .setSilent(!completed)
            .setDefaults(completed ? Notification.DEFAULT_ALL : 0)
            .setPriority(completed ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_LOW)
            .setCategory(completed ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_STOPWATCH)
            .addAction(0, "Terminar", stopPending)
            .build();
    }

    private void updateNotification() {
        try { NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildNotification()); } catch (SecurityException ignored) {}
    }

    private void finishServiceKeepingNotification() {
        handler.removeCallbacks(ticker);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
        stopSelf();
    }

    private void stopTimer() {
        running = false;
        handler.removeCallbacks(ticker);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void holdCpu() {
        releaseCpu();
        if (freeMode) return;
        wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Fitide:WorkoutTimer");
        wakeLock.acquire(Math.min(12 * 60 * 60 * 1000L, ((long) (workSeconds + restSeconds) * rounds + 60) * 1000L));
    }

    private void releaseCpu() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    @Override public void onDestroy() { releaseCpu(); handler.removeCallbacks(ticker); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
