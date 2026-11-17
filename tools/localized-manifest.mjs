import fs from 'node:fs/promises';

// Store listing language is independent of the user's browser UI language.
export async function localizedManifest(manifest, language) {
  const locale = language.replaceAll('-', '_');
  const catalogs = [];
  for (const candidate of new Set([locale, locale.split('_')[0], manifest.default_locale])) {
    try {
      catalogs.push(JSON.parse(await fs.readFile(new URL(`../extension/_locales/${candidate}/messages.json`, import.meta.url), 'utf8')));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const resolve = value => value.replace(/__MSG_([a-zA-Z0-9_]+)__/g, (_, key) => {
    const entry = catalogs.find(catalog => catalog[key]);
    if (!entry) throw new Error(`Missing manifest message: ${key}`);
    return entry[key].message;
  });
  return { ...manifest, name: resolve(manifest.name), description: resolve(manifest.description),
    action: { ...manifest.action, default_title: resolve(manifest.action.default_title) } };
}
