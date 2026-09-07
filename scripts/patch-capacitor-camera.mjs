import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pluginFile = fileURLToPath(new URL(
  '../node_modules/@capacitor/camera/android/src/main/java/com/capacitorjs/plugins/camera/IonCameraFlow.kt',
  import.meta.url,
));

const original = await readFile(pluginFile, 'utf8');
const oldBlock = `        val bitmap = BitmapFactory.decodeFile(mediaResult.uri)
        if (bitmap == null) {
            sendError(IONCAMRError.PROCESS_IMAGE_ERROR)
            return
        }

        val exif = ImageUtils.getExifData(context, bitmap, uri)
        val ret = JSObject()`;
const newBlock = `        val ret = JSObject()`;
const oldExif = `            metadata.put("exif", exif.toJson())`;
const newExif = `            val bitmap = BitmapFactory.decodeFile(mediaResult.uri)
            if (bitmap != null) {
                metadata.put("exif", ImageUtils.getExifData(context, bitmap, uri).toJson())
                bitmap.recycle()
            }`;

if (original.includes(newExif)) process.exit(0);
if (!original.includes(oldBlock) || !original.includes(oldExif)) {
  throw new Error('A versão do plugin Camera mudou; o patch de memória precisa ser revisto.');
}

await writeFile(pluginFile, original.replace(oldBlock, newBlock).replace(oldExif, newExif));
