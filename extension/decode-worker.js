importScripts('vendor/jsQR.js', 'decode-engine.js', 'decode-enhanced.js');
let readerReady;
function loadZXing(readError) {
  readerReady ||= (async () => {
    importScripts('vendor/zxing-reader.js');
    // Override the library's CDN default before any decoding occurs.
    // Supplying bytes also prevents an accidental remote URL fallback.
    const response = await fetch(new URL('vendor/zxing_reader.wasm', self.location.href));
    if (!response.ok) throw new Error(readError);
    ZXingWASM.prepareZXingModule({ overrides: { wasmBinary: await response.arrayBuffer() } });
    return ZXingWASM;
  })();
  return readerReady;
}
self.onmessage = async ({ data }) => {
  try {
    const results = await QRCSDecodeEnhanced(data.pixels, data.width, data.height, () => loadZXing(data.decoderReadError));
    self.postMessage({ ok: true, results });
  } catch (error) { self.postMessage({ ok: false, error: error.message }); }
};
