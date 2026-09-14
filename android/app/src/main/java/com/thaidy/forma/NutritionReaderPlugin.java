package com.thaidy.forma;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NutritionReader")
public class NutritionReaderPlugin extends Plugin {
    private final AtomicBoolean busy = new AtomicBoolean(false);

    @PluginMethod
    public void recognize(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("Já existe uma leitura em curso."); return; }
        Bitmap bitmap = null;
        try {
            String encoded = call.getString("image", "");
            if (encoded.isEmpty() || encoded.length() > 6000000) throw new IllegalArgumentException("Imagem demasiado grande.");
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (options.outWidth <= 0 || options.outHeight <= 0) throw new IllegalArgumentException("Imagem inválida.");
            options.inSampleSize = 1;
            while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 1800) options.inSampleSize *= 2;
            options.inJustDecodeBounds = false;
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (bitmap == null) throw new IllegalArgumentException("Imagem inválida.");
            final Bitmap image = bitmap;
            final var reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            reader.process(InputImage.fromBitmap(image, 0))
                .addOnSuccessListener(result -> {
                    // Sort lines spatially: ML Kit may return separate blocks for each column.
                    java.util.ArrayList<com.google.mlkit.vision.text.Text.Line> lines = new java.util.ArrayList<>();
                    for (var block : result.getTextBlocks()) lines.addAll(block.getLines());
                    lines.sort(java.util.Comparator.comparingInt(line -> line.getBoundingBox() == null ? 0 : line.getBoundingBox().centerY()));
                    StringBuilder text = new StringBuilder();
                    java.util.ArrayList<com.google.mlkit.vision.text.Text.Line> row = new java.util.ArrayList<>();
                    int rowY = -10000;
                    int tolerance = 8;
                    for (var line : lines) {
                        var box = line.getBoundingBox();
                        if (box == null) continue;
                        if (!row.isEmpty() && box.centerY() - rowY > tolerance) {
                            row.sort(java.util.Comparator.comparingInt(item -> item.getBoundingBox().left));
                            for (var item : row) text.append(item.getText()).append(' ');
                            text.append('\n'); row.clear();
                        }
                        if (row.isEmpty()) { rowY = box.centerY(); tolerance = Math.max(8, box.height() / 2); }
                        row.add(line);
                    }
                    row.sort(java.util.Comparator.comparingInt(item -> item.getBoundingBox().left));
                    for (var item : row) text.append(item.getText()).append(' ');
                    JSObject response = new JSObject();
                    response.put("text", text.toString());
                    call.resolve(response);
                })
                .addOnFailureListener(error -> call.reject("Não foi possível ler esta imagem.", error))
                .addOnCompleteListener(task -> { reader.close(); image.recycle(); busy.set(false); });
        } catch (Exception error) {
            if (bitmap != null) bitmap.recycle();
            busy.set(false);
            call.reject("Não foi possível preparar esta imagem.", error);
        }
    }
}
