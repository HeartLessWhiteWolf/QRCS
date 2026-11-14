/* A second, independent decoder handles stylized dots, rounded finders and logos.
 * loadZXing is supplied by the worker (local assets) or tests (local WASM bytes).
 */
globalThis.QRCSDecodeEnhanced = async function (pixels, width, height, loadZXing) {
  const results = QRCSDecode(pixels, width, height);
  let decoded;
  try {
    const reader = await loadZXing();
    decoded = await reader.readBarcodes({ data: new Uint8ClampedArray(pixels), width, height }, {
      formats: ['QRCode'], maxNumberOfSymbols: 8, tryHarder: true, tryRotate: true,
      tryInvert: true, tryDenoise: true, returnErrors: false, textMode: 'Plain'
    });
  } catch (error) {
    // Keep basic scans available if a browser cannot instantiate WASM.
    if (results.length) return results;
    throw error;
  }
  for (const code of decoded) {
    if (!code.isValid || code.error) continue;
    const binary = Array.from(code.bytes);
    const byteKey = binary.join(',');
    if (results.length < 8 && !results.some(result => result.byteKey === byteKey)) {
      results.push({ text: code.text, binary, byteKey, version: code.version, decoder: 'ZXing' });
    }
  }
  return results;
};
