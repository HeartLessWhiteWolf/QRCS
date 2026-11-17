import { getMessage } from './i18n.js';
// Shared URL and geometry rules. Selection coordinates are fractions of the frozen image.
export function safeWebURL(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^https?:\/\//i.test(text) || /[\u0000-\u0020\u007f]/.test(text)) return null;
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function selectionRect(a, b, width, height) {
  const clamp = (n, max) => Math.min(max, Math.max(0, n));
  if (![a.x, a.y, b.x, b.y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const x1 = clamp(Math.min(a.x, b.x), width), y1 = clamp(Math.min(a.y, b.y), height);
  const x2 = clamp(Math.max(a.x, b.x), width), y2 = clamp(Math.max(a.y, b.y), height);
  if (x2 - x1 < 8 || y2 - y1 < 8) return null;
  return { x: x1 / width, y: y1 / height, width: (x2 - x1) / width, height: (y2 - y1) / height };
}

export function pixelRect(rect, width, height) {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
      || rect.x + rect.width > 1.00001 || rect.y + rect.height > 1.00001) throw new Error(getMessage('errorInvalidSelection'));
  const x = Math.max(0, Math.floor(rect.x * width)), y = Math.max(0, Math.floor(rect.y * height));
  return { x, y, width: Math.max(1, Math.min(width - x, Math.ceil((rect.x + rect.width) * width) - x)),
    height: Math.max(1, Math.min(height - y, Math.ceil((rect.y + rect.height) * height) - y)) };
}

export function resultKind(text) {
  if (safeWebURL(text)) return getMessage('kindWebLink');
  if (/^WIFI:/i.test(text)) return getMessage('kindWifi');
  if (/^BEGIN:VCARD/i.test(text)) return getMessage('kindVcard');
  if (/^mailto:/i.test(text)) return getMessage('kindEmail');
  if (/^tel:/i.test(text)) return getMessage('kindPhone');
  return getMessage('kindText');
}
