import fs from 'node:fs/promises';

export const catalogs = Object.fromEntries(await Promise.all(['en', 'zh_CN'].map(async locale => [
  locale, JSON.parse(await fs.readFile(new URL(`../../extension/_locales/${locale}/messages.json`, import.meta.url), 'utf8'))
])));

export function createI18n(locale = 'en') {
  return { getMessage(key, substitutions = []) {
    const entry = catalogs[locale][key] || catalogs.en[key];
    if (!entry) return '';
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    // Resolve named placeholders first; substitute values once so user-provided
    // dollar signs and replacement patterns are preserved verbatim.
    const template = entry.message.replace(/\$([a-z][a-z0-9_]*)\$/gi, (_, name) => entry.placeholders[name.toLowerCase()].content);
    return template.replace(/\$([1-9])/g, (_, index) => values[Number(index) - 1] ?? '');
  } };
}
