// GIF89a block layout: https://www.w3.org/Graphics/GIF/spec-gif89a.txt
// Keep the original palette and compressed first image, without decoding pixels
// or sending subsequent animation frames to the phone.
export function firstGifFrame(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 13) return null;
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== 'GIF89a' && signature !== 'GIF87a') throw new Error('Invalid GIF');
  const headerEnd = 13 + ((bytes[10] & 0x80) ? 3 * (2 ** ((bytes[10] & 7) + 1)) : 0);
  if (bytes.length < headerEnd) return null;
  let position = headerEnd;
  let control: Uint8Array | undefined;
  function skipBlocks(start: number): number | null {
    let cursor = start;
    while (cursor < bytes.length) {
      const size = bytes[cursor++];
      if (!size) return cursor;
      cursor += size;
    }
    return null;
  }
  while (position < bytes.length) {
    const start = position;
    const marker = bytes[position++];
    if (marker === 0x21) {
      if (position >= bytes.length) return null;
      const label = bytes[position++];
      const end = skipBlocks(position);
      if (end === null) return null;
      if (label === 0xf9) control = bytes.subarray(start, end);
      if (label === 0x01) control = undefined; // Plain text consumes its graphic control.
      position = end;
    } else if (marker === 0x2c) {
      if (bytes.length < start + 10) return null;
      const packed = bytes[start + 9];
      position = start + 10 + ((packed & 0x80) ? 3 * (2 ** ((packed & 7) + 1)) : 0);
      if (position >= bytes.length) return null;
      const end = skipBlocks(position + 1); // Skip LZW minimum code size.
      if (end === null) return null;
      const output = new Uint8Array(headerEnd + (control?.length ?? 0) + end - start + 1);
      output.set(bytes.subarray(0, headerEnd));
      if (control) output.set(control, headerEnd);
      output.set(bytes.subarray(start, end), headerEnd + (control?.length ?? 0));
      output[output.length - 1] = 0x3b;
      return output;
    } else {
      throw new Error('GIF has no valid first image');
    }
  }
  return null;
}

export async function readGifPreview(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const maxBytes = 2 * 1024 * 1024;
  let buffer = new Uint8Array(64 * 1024);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error('Incomplete GIF');
      if (size + value.length > maxBytes) throw new Error('GIF preview too large');
      if (size + value.length > buffer.length) {
        const larger = new Uint8Array(Math.min(maxBytes, Math.max(buffer.length * 2, size + value.length)));
        larger.set(buffer.subarray(0, size));
        buffer = larger;
      }
      buffer.set(value, size);
      size += value.length;
      const preview = firstGifFrame(buffer.subarray(0, size));
      if (preview) return preview;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
