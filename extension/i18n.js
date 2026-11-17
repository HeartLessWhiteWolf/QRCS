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

export async function setOffscreenMessages(messages) {
  // An already-running background can still send the older job format after
  // extension files are replaced. Recover from bundled assets before decoding.
  const complete = offscreenKeys.every(key => typeof messages?.[key] === 'string' && messages[key]);
  if (complete) { offscreenMessages = messages; return; }
  const locale = /^zh(?:[-_]|$)/i.test(globalThis.navigator?.language || '') ? 'zh_CN' : 'en';
  const failure = detail => new Error(`Language pack (${locale}): ${detail}. Reload or reinstall QRCS.`);
  let response;
  try { response = await fetch(new URL(`_locales/${locale}/messages.json`, import.meta.url)); }
  catch { throw failure('the bundled file could not be read'); }
  if (!response.ok) throw failure(`the bundled file could not be read (HTTP ${response.status ?? 'error'})`);
  let catalog;
  try { catalog = await response.json(); }
  catch { throw failure('the bundled file is not valid JSON'); }
  offscreenMessages = Object.fromEntries(offscreenKeys.map(key => {
    if (typeof messages?.[key] === 'string' && messages[key]) return [key, messages[key]];
    const entry = catalog?.[key];
    if (typeof entry?.message !== 'string' || !entry.message.trim()) throw failure(`missing or invalid message "${key}"`);
    const template = entry.message.replace(/\$([a-z][a-z0-9_]*)\$/gi, (_, name) => {
      const content = entry.placeholders?.[name.toLowerCase()]?.content;
      if (typeof content !== 'string') throw failure(`missing or invalid placeholder "${name}" in "${key}"`);
      return content;
    });
    return [key, template];
  }));
}

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
