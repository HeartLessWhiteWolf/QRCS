import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { catalogs, createI18n } from './helpers/i18n.mjs';
import { getMessage, getOffscreenMessages, setOffscreenMessages, localize } from '../extension/i18n.js';
import { pixelRect, resultKind } from '../extension/core.js';
import { createMenuRegistrar } from '../extension/context-menu.js';
import { localizedManifest } from '../tools/localized-manifest.mjs';

test('locale catalogs cover manifest, code and HTML without hardcoded Chinese UI text', async () => {
  assert.deepEqual(Object.keys(catalogs.zh_CN).sort(), Object.keys(catalogs.en).sort());
  for (const [key, entry] of Object.entries(catalogs.en)) {
    assert.ok(entry.message.trim(), key);
    assert.ok(catalogs.zh_CN[key].message.trim(), key);
    assert.deepEqual(entry.placeholders, catalogs.zh_CN[key].placeholders, key);
    for (const locale of ['en', 'zh_CN']) {
      const rendered = createI18n(locale).getMessage(key, 'EXAMPLE');
      assert.doesNotMatch(rendered, /\$[a-z][a-z0-9_]*\$|\$[1-9]/i, key);
    }
  }
  const manifest = JSON.parse(await fs.readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, '__MSG_extensionName__');
  assert.equal(manifest.description, '__MSG_extensionDescription__');
  assert.equal(manifest.action.default_title, '__MSG_actionTitle__');
  for (const [language, locale] of [['zh-CN', 'zh_CN'], ['en-US', 'en'], ['fr', 'en']]) {
    const resolved = await localizedManifest(manifest, language);
    assert.equal(resolved.name, catalogs[locale].extensionName.message);
    assert.equal(resolved.description, catalogs[locale].extensionDescription.message);
    assert.equal(resolved.action.default_title, catalogs[locale].actionTitle.message);
  }
  for (const entry of await fs.readdir(new URL('../extension/', import.meta.url), { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(js|html|json)$/.test(entry.name)) continue;
    const source = await fs.readFile(new URL('../extension/' + entry.name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\p{Script=Han}/u, entry.name);
    for (const match of source.matchAll(/(?:getMessage\(['"]|data-i18n(?:-aria-label|-alt)?=["']|__MSG_)([a-zA-Z][a-zA-Z0-9]*)(?:['"]|__)/g)) {
      assert.ok(catalogs.en[match[1]], `${entry.name}: ${match[1]}`);
    }
  }
});

test('both locales translate menus, content kinds, errors and offscreen substitutions', async () => {
  for (const locale of ['en', 'zh_CN']) {
    const i18n = createI18n(locale);
    globalThis.chrome = { i18n };
    assert.equal(resultKind('WIFI:S:test;;'), i18n.getMessage('kindWifi'));
    assert.throws(() => pixelRect(null, 100, 100), { message: i18n.getMessage('errorInvalidSelection') });
    let title;
    await createMenuRegistrar({ i18n, contextMenus: { async update(_id, properties) { title = properties.title; } } })();
    assert.equal(title, i18n.getMessage('menuScan'));
    const messages = getOffscreenMessages();
    globalThis.chrome = { runtime: {} };
    setOffscreenMessages(messages);
    assert.equal(getMessage('errorImageDenied', '403'), i18n.getMessage('errorImageDenied', '403'));
    assert.equal(getMessage('errorRetryScreenshot', 'reason $1 <img>'), i18n.getMessage('errorRetryScreenshot', 'reason $1 <img>'));
    assert.equal(getMessage('progressDecode'), i18n.getMessage('progressDecode'));
    assert.equal(getMessage('offscreenTitle'), i18n.getMessage('offscreenTitle'));
  }
  delete globalThis.chrome;
});

test('DOM localization writes text and accessibility attributes without parsing translated HTML', () => {
  globalThis.chrome = { i18n: createI18n('en') };
  const text = { dataset: { i18n: 'cancel' } };
  const attributes = {};
  const image = { getAttribute: () => 'currentScreenshot', setAttribute: (key, value) => { attributes[key] = value; } };
  localize({ querySelectorAll: selector => selector === '[data-i18n]' ? [text] : selector === '[data-i18n-alt]' ? [image] : [] });
  assert.equal(text.textContent, 'Cancel');
  assert.equal(attributes.alt, 'Current page screenshot');
  delete globalThis.chrome;
});

test('decode worker returns the supplied localized resource error without extension APIs', async () => {
  const source = await fs.readFile(new URL('../extension/decode-worker.js', import.meta.url), 'utf8');
  for (const locale of ['en', 'zh_CN']) {
    let reply;
    const sandbox = vm.createContext({
      importScripts() {}, URL,
      self: { location: { href: 'chrome-extension://qrcs/decode-worker.js' }, postMessage(value) { reply = value; } },
      fetch: async () => ({ ok: false }),
      QRCSDecodeEnhanced: async (_pixels, _width, _height, load) => load()
    });
    vm.runInContext(source, sandbox);
    const error = createI18n(locale).getMessage('errorDecoderRead');
    await sandbox.self.onmessage({ data: { pixels: new ArrayBuffer(4), width: 1, height: 1, decoderReadError: error } });
    assert.equal(reply.ok, false);
    assert.equal(reply.error, error);
  }
});
