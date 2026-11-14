/* Pure decoder shared by the Web Worker and fixture tests. jsQR is bundled locally. */
globalThis.QRCSDecode = function decode(pixels, width, height, maxCodes = 8) {
  const data = new Uint8ClampedArray(pixels);
  const results = [];
  // With several codes, a whole-image scan may combine finder patterns from
  // different symbols. Overlapping tiles keep each complete symbol discoverable.
  const regions = [{ x: 0, y: 0, width, height }];
  const add = (x, y, w, h) => regions.push({ x: Math.floor(x), y: Math.floor(y), width: Math.ceil(w), height: Math.ceil(h) });
  if (width >= 160 && height >= 160) {
    if (width >= height * 1.4) {
      add(0, 0, width * .6, height); add(width * .4, 0, width * .6, height);
    } else if (height >= width * 1.4) {
      add(0, 0, width, height * .6); add(0, height * .4, width, height * .6);
    }
    for (const x of [0, .4]) for (const y of [0, .4]) add(width * x, height * y, width * .6, height * .6);
    // A dense page can put two complete symbols inside a 60% tile. Smaller,
    // overlapping windows separate them while retaining each symbol's margin.
    for (const x of [0, .25, .5]) for (const y of [0, .25, .5]) add(width * x, height * y, width * .5, height * .5);
  }
  for (let next = 0, hits = 0; next < regions.length && hits < maxCodes * 3 && results.length < maxCodes;) {
    const region = regions[next++];
    const tile = region === regions[0] ? data : new Uint8ClampedArray(region.width * region.height * 4);
    if (tile !== data) for (let y = 0; y < region.height; y++) {
      const from = ((region.y + y) * width + region.x) * 4;
      tile.set(data.subarray(from, from + region.width * 4), y * region.width * 4);
    }
    const code = jsQR(tile, region.width, region.height, { inversionAttempts: 'attemptBoth' });
    if (!code) continue;
    hits++;
    const text = code.data || '';
    const byteKey = Array.from(code.binaryData).join(',');
    if (!results.some(result => result.byteKey === byteKey)) {
      results.push({ text, byteKey, binary: Array.from(code.binaryData), version: code.version });
    }
    const points = [code.location.topLeftCorner, code.location.topRightCorner, code.location.bottomLeftCorner, code.location.bottomRightCorner];
    const x1 = Math.max(0, region.x + Math.floor(Math.min(...points.map(p => p.x))) - 3);
    const y1 = Math.max(0, region.y + Math.floor(Math.min(...points.map(p => p.y))) - 3);
    const x2 = Math.min(width, region.x + Math.ceil(Math.max(...points.map(p => p.x))) + 3);
    const y2 = Math.min(height, region.y + Math.ceil(Math.max(...points.map(p => p.y))) + 3);
    if (x2 <= x1 || y2 <= y1) break;
    for (let y = y1; y < y2; y++) data.fill(255, (y * width + x1) * 4, (y * width + x2) * 4);
    // Once a symbol is masked, previously ambiguous regions may become readable.
    next = 0;
  }
  return results;
};
