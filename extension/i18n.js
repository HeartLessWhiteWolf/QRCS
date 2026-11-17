// Offscreen documents only expose chrome.runtime. The background resolves these
// messages with Chrome's locale fallback and passes them with each decode job.
const offscreenKeys = [
  'uiLanguage', 'offscreenTitle', 'errorInvalidSelection', 'errorEmptyImage',
  'errorImageFormat', 'errorImageDenied', 'errorImageTooLarge', 'errorImageTimeout',
  'errorCancelled', 'errorDecodeTimeout', 'errorWorkerStart', 'errorNoCode',
  'errorRetryScreenshot', 'errorDecoderRead', 'progressResize', 'progressDecode',
  'progressScreenshotFallback'
];
let offscreenMessages;

export function getOffscreenMessages() {
  return Object.fromEntries(offscreenKeys.map(key => [key, chrome.i18n.getMessage(key, ['$1'])]));
}

export function setOffscreenMessages(messages) { offscreenMessages = messages; }

export function getMessage(key, substitutions = []) {
  if (globalThis.chrome?.i18n) return chrome.i18n.getMessage(key, substitutions);
  const template = offscreenMessages?.[key];
  if (typeof template !== 'string') throw new Error(`Missing localized message: ${key}`);
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return template.replace(/\$([1-9])/g, (_, index) => values[Number(index) - 1] ?? '');
}

export function localize(root = document) {
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = getMessage(element.dataset.i18n);
  }
  for (const attribute of ['aria-label', 'alt']) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, getMessage(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
