/**
 * The tests run in Node, whose Web Crypto has no timingSafeEqual: it is a
 * Workers extension. The admin-auth tests exercise the real handler, so
 * Node gets an equivalent with the same contract (throws on unequal
 * lengths, compares every byte).
 */
if (typeof crypto.subtle.timingSafeEqual !== 'function') {
  Object.defineProperty(crypto.subtle, 'timingSafeEqual', {
    value(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean {
      const left = bytes(a);
      const right = bytes(b);
      if (left.length !== right.length) throw new TypeError('Input buffers must have the same length');
      let diff = 0;
      for (let i = 0; i < left.length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
      return diff === 0;
    },
  });
}

function bytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
