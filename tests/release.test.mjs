import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkVersions, projectRoot } from '../tools/check-versions.mjs';
import { checkPrivacyPage } from '../tools/privacy-check.mjs';
import { runChecks } from '../tools/prepublish-check.mjs';

async function metadataFixture(t) {
  const parent = path.join(projectRoot, 'tmp');
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'version-test-'));
  t.after(async () => {
    if (path.dirname(root) !== parent || !path.basename(root).startsWith('version-test-')) throw new Error('Unexpected fixture path');
    await fs.rm(root, { recursive: true, force: true });
  });
  const documents = {
    'extension/manifest.json': { version: '1.2.3' },
    'package.json': { version: '1.2.3' },
    'package-lock.json': { version: '1.2.3', packages: { '': { version: '1.2.3' } } },
    'publishing/publisher.json': { extensionVersion: '1.2.3' }
  };
  const write = async () => {
    for (const [file, value] of Object.entries(documents)) {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), JSON.stringify(value));
    }
  };
  await write();
  return { root, documents, write };
}

test('release versions accept consistent metadata without modifying files', async t => {
  const { root, documents } = await metadataFixture(t);
  assert.equal(await checkVersions(root), '1.2.3');
  for (const [file, value] of Object.entries(documents)) assert.equal(await fs.readFile(path.join(root, file), 'utf8'), JSON.stringify(value));
});

test('release versions identify every mismatched field with the expected version', async t => {
  const { root, documents, write } = await metadataFixture(t);
  const mutations = [
    ['package.json', value => { value.version = '0.0.1'; }, 'package.json.version'],
    ['package-lock.json', value => { value.version = '0.0.1'; }, 'package-lock.json.version'],
    ['package-lock.json', value => { delete value.packages[''].version; }, 'package-lock.json.packages[""].version'],
    ['publishing/publisher.json', value => { value.extensionVersion = '0.0.1'; }, 'publishing/publisher.json.extensionVersion']
  ];
  for (const [file, mutate, field] of mutations) {
    const original = structuredClone(documents[file]);
    mutate(documents[file]); await write();
    await assert.rejects(checkVersions(root), error => error.message.includes(field) && error.message.includes('请改为 1.2.3'));
    documents[file] = original;
  }
});

test('release versions report missing metadata and missing manifest version clearly', async t => {
  const { root, documents, write } = await metadataFixture(t);
  delete documents['extension/manifest.json'].version; await write();
  await assert.rejects(checkVersions(root), /manifest\.json\.version 缺失/);
  await fs.unlink(path.join(root, 'publishing/publisher.json'));
  await assert.rejects(checkVersions(root), /无法读取版本元数据 publishing\/publisher\.json/);
});

test('actual pack command rejects mismatched publisher metadata before writing a ZIP', async t => {
  const { root, documents, write } = await metadataFixture(t);
  documents['publishing/publisher.json'].extensionVersion = '0.0.1'; await write();
  await fs.mkdir(path.join(root, 'tools'), { recursive: true });
  for (const file of ['pack.mjs', 'check-versions.mjs']) await fs.copyFile(path.join(projectRoot, 'tools', file), path.join(root, 'tools', file));
  await assert.rejects(promisify(execFile)(process.execPath, [path.join(root, 'tools/pack.mjs')], { windowsHide: true, timeout: 5000 }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /publisher\.json\.extensionVersion/);
    return true;
  });
  await assert.rejects(fs.access(path.join(root, 'dist')), { code: 'ENOENT' });
});

test('privacy validation accepts matching public content', async () => {
  const result = await checkPrivacyPage('https://example.com/privacy', 'test@example.com', async () => ({ ok: true, text: async () => 'QRCS test@example.com' }));
  assert.equal(result.status, 'passed');
});

test('privacy transport and body interruptions remain unverified instead of material errors', async () => {
  for (const fetchPage of [
    async () => { throw new TypeError('fetch failed'); },
    async () => ({ ok: true, text: async () => { throw new Error('connection reset'); } })
  ]) assert.equal((await checkPrivacyPage('https://example.com/privacy', 'test@example.com', fetchPage)).status, 'network-unverified');
});

test('privacy HTTP failures, wrong content and placeholders are material errors', async () => {
  const badHTTP = await checkPrivacyPage('https://example.com/privacy', 'test@example.com', async () => ({ ok: false, status: 404 }));
  assert.equal(badHTTP.status, 'invalid'); assert.match(badHTTP.message, /HTTP 404/);
  for (const body of ['QRCS', 'test@example.com', 'QRCS test@example.com {{email}}', 'QRCS test@example.com 【待填写']) {
    assert.equal((await checkPrivacyPage('https://example.com/privacy', 'test@example.com', async () => ({ ok: true, text: async () => body }))).status, 'invalid');
  }
});

const steps = [
  { name: 'versions', args: ['versions'] },
  { name: 'tests', args: ['tests'] },
  { name: 'pack', args: ['pack'] },
  { name: 'online', args: ['online'], networkCheck: true },
  { name: 'later', args: ['later'] }
];

test('prepublish checks run sequentially and complete only after all steps succeed', async () => {
  const order = [], logs = [];
  assert.equal(await runChecks(steps, async args => { order.push(args[0]); return 0; }, text => logs.push(text)), 0);
  assert.deepEqual(order, steps.map(step => step.args[0]));
  assert.match(logs.at(-1), /人工完成/);
});

test('prepublish checks stop on errors and do not package after failed tests', async () => {
  const order = [], logs = [];
  assert.equal(await runChecks(steps, async args => { order.push(args[0]); return args[0] === 'tests' ? 1 : 0; }, text => logs.push(text)), 1);
  assert.deepEqual(order, ['versions', 'tests']);
  assert.match(logs.at(-1), /FAIL \[2\/5\] tests/);
});

test('prepublish network incompleteness has its own exit status and stops later steps', async () => {
  const order = [], logs = [];
  assert.equal(await runChecks(steps, async args => { order.push(args[0]); return args[0] === 'online' ? 2 : 0; }, text => logs.push(text)), 2);
  assert.deepEqual(order, ['versions', 'tests', 'pack', 'online']);
  assert.match(logs.at(-1), /INCOMPLETE.*线上网络验证未完成/);
  assert.equal(await runChecks(steps, async () => 2, () => {}), 1, 'Exit 2 in a non-network step is an actual failure');
});

test('prepublish process launch failures identify the failed step', async () => {
  const logs = [];
  assert.equal(await runChecks(steps, async () => { throw new Error('spawn failed'); }, text => logs.push(text)), 1);
  assert.match(logs.at(-1), /FAIL \[1\/5\] versions：spawn failed/);
});
