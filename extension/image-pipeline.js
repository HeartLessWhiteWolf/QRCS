import { getMessage } from './i18n.js';
import { pixelRect } from './core.js';

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.naturalWidth && img.naturalHeight ? resolve(img) : reject(new Error(getMessage('errorEmptyImage')));
    img.onerror = () => reject(new Error(getMessage('errorImageFormat')));
    img.src = src;
  });
}
async function originalImage(src) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let objectURL;
  try {
    const response = await fetch(src, { signal: controller.signal, credentials: 'include', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(getMessage('errorImageDenied', String(response.status)));
    if (Number(response.headers.get('content-length')) > 24 * 1024 * 1024) throw new Error(getMessage('errorImageTooLarge'));
    const blob = await response.blob();
    if (blob.size > 24 * 1024 * 1024) throw new Error(getMessage('errorImageTooLarge'));
    objectURL = URL.createObjectURL(blob);
    return await loadImage(objectURL);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(getMessage('errorImageTimeout'));
    throw error;
  } finally { clearTimeout(timer); if (objectURL) URL.revokeObjectURL(objectURL); }
}

export class ImagePipeline {
  #worker;
  #abortWorker;
  #cancelled = false;
  cancel() {
    this.#cancelled = true;
    this.#abortWorker?.(new Error(getMessage('errorCancelled')));
  }
  #check() { if (this.#cancelled) throw new Error(getMessage('errorCancelled')); }
  #runWorker(imageData) {
    return new Promise((resolve, reject) => {
      this.#check();
      const worker = new Worker(new URL('decode-worker.js', import.meta.url));
      this.#worker = worker;
      const finish = (error, value) => {
        clearTimeout(timer); worker.terminate(); this.#worker = null; this.#abortWorker = null;
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => finish(new Error(getMessage('errorDecodeTimeout'))), 15000);
      this.#abortWorker = error => finish(error);
      worker.onerror = () => finish(new Error(getMessage('errorWorkerStart')));
      worker.onmessage = ({ data }) => data.ok ? finish(null, data.results) : finish(new Error(data.error));
      worker.postMessage({ pixels: imageData.data.buffer, width: imageData.width, height: imageData.height,
        decoderReadError: getMessage('errorDecoderRead') }, [imageData.data.buffer]);
    });
  }
  async decode(image, rect, progress = () => {}) {
    this.#check();
    const region = rect ? pixelRect(rect, image.naturalWidth, image.naturalHeight)
      : { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
    const limit = Math.min(1, 2200 / Math.max(region.width, region.height));
    const scales = [...new Set([limit, limit * .65, Math.min(3, 900 / Math.max(region.width, region.height))])];
    for (let index = 0; index < scales.length; index++) {
      this.#check(); progress(index ? getMessage('progressResize') : getMessage('progressDecode'));
      const width = Math.max(1, Math.round(region.width * scales[index])), height = Math.max(1, Math.round(region.height * scales[index]));
      const canvas = document.createElement('canvas'); canvas.width = width + 32; canvas.height = height + 32;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = scales[index] < 1;
      ctx.drawImage(image, region.x, region.y, region.width, region.height, 16, 16, width, height);
      const results = await this.#runWorker(ctx.getImageData(0, 0, canvas.width, canvas.height));
      canvas.width = canvas.height = 1;
      this.#check(); if (results.length) return results;
    }
    throw new Error(getMessage('errorNoCode'));
  }
  async run(job, progress = () => {}) {
    if (job.mode === 'error') throw new Error(job.error);
    if (job.mode === 'crop') return { results: await this.decode(await loadImage(job.screenshot), job.rect, progress), wholeScreenshotFallback: false };
    try { return { results: await this.decode(await originalImage(job.imageUrl), null, progress), wholeScreenshotFallback: false }; }
    catch (error) {
      this.#check(); if (!job.screenshot) throw error;
      progress(getMessage('progressScreenshotFallback'));
      try { return { results: await this.decode(await loadImage(job.screenshot), null, progress), wholeScreenshotFallback: true }; }
      catch (fallbackError) { this.#check(); throw new Error(getMessage('errorRetryScreenshot', error.message)); }
    }
  }
}
