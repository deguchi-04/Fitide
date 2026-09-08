import assert from 'node:assert/strict';
import { firstGifFrame, readGifPreview } from '../lib/gif-preview.ts';

const header = [71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255];
const frame = [44,0,0,0,0,1,0,1,0,0,2,2,68,1,0];
const control = [33,249,4,1,10,0,0,0];
const loop = [33,255,11,...Buffer.from('NETSCAPE2.0'),3,1,0,0,0];
const animated = Uint8Array.from([...header,...loop,...control,...frame,...control,...frame,59]);
const expected = Uint8Array.from([...header,...control,...frame,59]);
assert.deepEqual(firstGifFrame(animated), expected);
assert.deepEqual(firstGifFrame(expected), expected);
for (let size = 0; size < animated.length - control.length - frame.length - 1; size++) {
  assert.equal(firstGifFrame(animated.subarray(0, size)), null, `incomplete prefix ${size}`);
}
const localPaletteFrame = [...frame.slice(0, 9),128,0,0,0,255,255,255,...frame.slice(10)];
const localGif = Uint8Array.from([...header.slice(0,10),0,0,0,...localPaletteFrame,59]);
assert.deepEqual(firstGifFrame(localGif),localGif);
assert.throws(() => firstGifFrame(Uint8Array.from({length:20}, () => 0)));
let cancelled = false;
let cursor = 0;
const stream = new ReadableStream({
  pull(controller) {
    if (cursor >= animated.length) return controller.close();
    controller.enqueue(animated.slice(cursor,cursor + 3)); cursor += 3;
  },
  cancel() { cancelled = true; },
});
assert.deepEqual(await readGifPreview(stream),expected);
assert.equal(cancelled,true);
await assert.rejects(readGifPreview(new ReadableStream({start(controller) {controller.enqueue(animated.slice(0,15));controller.close();}})));
console.log('GIF preview tests passed: one frame, palettes, transparency, no animation loop, truncated/invalid data, streaming cancellation.');

if (process.argv.includes('--live')) {
  const origin = process.env.FITIDE_TEST_ORIGIN ?? 'http://localhost:3000';
  const base = `${origin}/api/workout?gif=0001`;
  const [full, preview] = await Promise.all([fetch(base), fetch(`${base}&preview=1`)]);
  assert.equal(full.status,200); assert.equal(preview.status,200);
  assert.match(preview.headers.get('content-type'),/image\/gif/);
  const originalBytes = new Uint8Array(await full.arrayBuffer());
  const previewBytes = new Uint8Array(await preview.arrayBuffer());
  assert.deepEqual(previewBytes,firstGifFrame(originalBytes));
  assert.ok(previewBytes.length < originalBytes.length);
  console.log(`Live preview verified: ${originalBytes.length} → ${previewBytes.length} bytes.`);
}

if (process.argv.includes('--source')) {
  const url = 'https://forma-pessoal.thaidy-deguchi.chatgpt.site/api/workout?gif=0001';
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const original = new Uint8Array(await response.arrayBuffer());
  const single = firstGifFrame(original);
  assert.ok(single && single.length < original.length);
  const streamed = await readGifPreview((await fetch(url)).body);
  assert.deepEqual(streamed, single);
  console.log(`Real WorkoutX GIF: ${original.length} → ${single.length} bytes, static stream verified.`);
}
