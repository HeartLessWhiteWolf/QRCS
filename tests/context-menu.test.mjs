import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuRegistrar } from '../extension/context-menu.js';

test('菜单存在时更新；缺失时重建，并合并并发注册', async () => {
  let missing = true, updates = 0, creates = 0;
  const api = { runtime: {}, contextMenus: {
    async update(id, properties) { updates++; assert.equal(id, 'qrcs-image'); for (const context of ['image', 'page', 'frame', 'link']) assert.ok(properties.contexts.includes(context)); if (missing) throw Error('missing'); },
    create(properties, done) { creates++; assert.equal(properties.title, 'QR码识别'); missing = false; done(); }
  } };
  const register = createMenuRegistrar(api);
  await Promise.all([register(), register()]);
  assert.equal(updates, 1); assert.equal(creates, 1);
  await register(); assert.equal(updates, 2); assert.equal(creates, 1);
  missing = true; await register(); assert.equal(creates, 2);
});

test('菜单注册失败可报告，并允许下次重试', async () => {
  const api = { runtime: { lastError: { message: 'failed' } }, contextMenus: {
    async update() { throw Error('missing'); }, create(_properties, done) { done(); }
  } };
  const register = createMenuRegistrar(api);
  await assert.rejects(register(), /failed/);
  delete api.runtime.lastError; await register();
});
