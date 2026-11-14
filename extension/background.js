import { safeWebURL, pixelRect } from './core.js';

const MENU = 'qrcs-image', PREFIX = 'qrcs-job-', MAX_AGE = 30 * 60 * 1000;
const scanning = new Set();
let creatingOffscreen;
chrome.runtime.onInstalled.addListener(() => { void (async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: MENU, title: 'QR码识别', contexts: ['image'] });
})(); });
async function cleanJobs() {
  const all = await chrome.storage.session.get(null);
  for (const job of Object.values(all).filter(job => job?.id && Date.now() - job.created > MAX_AGE)) await dropJob(job);
}
async function createJob(tab, extra) {
  await cleanJobs();
  const job = { id: crypto.randomUUID(), created: Date.now(), tabId: tab.id, windowId: tab.windowId, ...extra };
  await saveJob(job); return job;
}
async function getJob(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new Error('识别任务无效。');
  const job = (await chrome.storage.session.get(PREFIX + id))[PREFIX + id];
  if (!job || Date.now() - job.created > MAX_AGE) throw new Error('识别任务已结束，请重新点击插件。');
  return job;
}
async function saveJob(job) { await chrome.storage.session.set({ [PREFIX + job.id]: job }); }
async function dropJob(job) {
  await chrome.storage.session.remove(PREFIX + job.id);
  void chrome.runtime.sendMessage({ target: 'qrcs-offscreen', type: 'QRCS_STOP_DECODE', jobId: job.id }).catch(() => {});
  if (job.presentation === 'toolbar') {
    const popup = await chrome.action.getPopup({ tabId: job.tabId }).catch(() => '');
    if (popup.includes(job.id)) {
      await chrome.action.setPopup({ tabId: job.tabId, popup: '' }).catch(() => {});
      await chrome.action.setBadgeText({ tabId: job.tabId, text: '' }).catch(() => {});
    }
  }
}
async function offscreenDecode(job) {
  const url = chrome.runtime.getURL('offscreen.html');
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (!contexts.length) {
    creatingOffscreen ||= chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['WORKERS', 'BLOBS'], justification: '在不可见的扩展页面中本地读取图像并运行二维码解码 Worker，结果显示在网页内。' }).finally(() => { creatingOffscreen = null; });
    await creatingOffscreen;
  }
  const result = await chrome.runtime.sendMessage({ target: 'qrcs-offscreen', type: 'QRCS_DECODE_JOB', job });
  if (!result?.ok) throw new Error(result?.error || '本地解码未能完成。');
  return result;
}
async function clearUI(tabId) {
  await chrome.tabs.sendMessage(tabId, { type: 'QRCS_CLOSE_RESULT' }).catch(() => {});
  await chrome.tabs.sendMessage(tabId, { type: 'QRCS_CLOSE_OVERLAY' }).catch(() => {});
}
async function toolbarView(job) {
  job.presentation = 'toolbar'; await saveJob(job);
  await chrome.action.setPopup({ tabId: job.tabId, popup: 'scanner.html?job=' + job.id + '&compact=1' });
  await chrome.action.setBadgeBackgroundColor({ tabId: job.tabId, color: '#087e81' });
  await chrome.action.setBadgeText({ tabId: job.tabId, text: 'QR' });
  try { await chrome.action.openPopup({ windowId: job.windowId }); }
  catch { /* User can click the QR badge. Never create an OS window. */ }
}
export async function presentJob(job) {
  try {
    await chrome.scripting.executeScript({ target: { tabId: job.tabId }, files: ['result-panel.js'] });
    job.presentation = 'panel'; await saveJob(job);
    const reply = await chrome.tabs.sendMessage(job.tabId, { type: 'QRCS_SHOW_RESULT', jobId: job.id, canRetry: Boolean(job.screenshot) });
    if (!reply?.ok) throw new Error('页面浮层不可用');
  } catch { await toolbarView(job); return; }
  try {
    const decoded = job.mode === 'error' ? { error: job.error } : await offscreenDecode(job);
    if (decoded.results) decoded.results = decoded.results.map(result => ({ ...result, url: safeWebURL(result.text) }));
    const current = await getJob(job.id); // Cancelled tasks must not reopen a panel.
    Object.assign(current, decoded); await saveJob(current);
    await chrome.tabs.sendMessage(job.tabId, { type: 'QRCS_UPDATE_RESULT', jobId: job.id, ...decoded });
  } catch (error) {
    const current = await getJob(job.id).catch(() => null);
    if (!current) return;
    current.error = error.message; await saveJob(current);
    await chrome.tabs.sendMessage(job.tabId, { type: 'QRCS_UPDATE_RESULT', jobId: job.id, error: error.message }).catch(() => {});
  }
}
async function capture(tab) {
  const check = async () => {
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id) throw new Error('标签页已切换，请在二维码所在标签页重新扫描。');
  };
  await check(); const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }); await check(); return image;
}
export async function beginSelection(tab) {
  if (scanning.has(tab.id)) return;
  scanning.add(tab.id);
  try {
    await clearUI(tab.id);
    const job = await createJob(tab, { mode: 'select', screenshot: await capture(tab) });
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selection.js'] });
      const reply = await chrome.tabs.sendMessage(tab.id, { type: 'QRCS_SELECT', jobId: job.id, screenshot: job.screenshot });
      if (!reply?.ok) throw new Error('页面框选不可用');
    } catch { await toolbarView(job); }
  } catch (error) {
    await presentJob(await createJob(tab, { mode: 'error', error: '无法截取当前页面：' + error.message }));
  } finally { scanning.delete(tab.id); }
}
export async function beginImage(info, tab) {
  await clearUI(tab.id);
  let screenshot;
  try { screenshot = await capture(tab); } catch { /* Original image remains usable. */ }
  const imageUrl = info.srcUrl;
  const valid = typeof imageUrl === 'string' && /^(https?:|data:image\/|blob:)/i.test(imageUrl);
  await presentJob(await createJob(tab, valid ? { mode: 'image', imageUrl, screenshot }
    : { mode: 'error', error: '无法读取这张图片，请点击插件图标进行截图框选。', screenshot }));
}
chrome.action.onClicked.addListener(tab => { void beginSelection(tab); });
chrome.contextMenus.onClicked.addListener((info, tab) => { if (info.menuItemId === MENU && tab) void beginImage(info, tab); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || message.target === 'qrcs-offscreen' || !message.type?.startsWith('QRCS_')) return;
  const internal = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('scanner.html'));
  void (async () => {
    const job = await getJob(message.jobId);
    const ownPage = sender.id === chrome.runtime.id && sender.tab?.id === job.tabId && sender.frameId === 0;
    if (!internal && !ownPage) throw new Error('不允许的请求来源。');
    switch (message.type) {
      case 'QRCS_CROP':
        if (!ownPage) throw new Error('页面与任务不匹配。');
        pixelRect(message.rect, 1000, 1000); job.mode = 'crop'; job.rect = message.rect;
        await saveJob(job); void presentJob(job); return { ok: true };
      case 'QRCS_GET_JOB':
        if (!internal) throw new Error('仅扩展弹层可读取图像任务。');
        return { ok: true, job };
      case 'QRCS_CANCEL_OVERLAY':
      case 'QRCS_DROP_JOB': await dropJob(job); return { ok: true };
      case 'QRCS_RETRY':
        await dropJob(job); void beginSelection(await chrome.tabs.get(job.tabId)); return { ok: true };
      case 'QRCS_OPEN_URL': {
        const url = safeWebURL(message.url);
        if (!url) throw new Error('仅支持打开有效的 HTTP / HTTPS 网页链接。');
        await chrome.tabs.create({ url, windowId: job.windowId, active: true }); return { ok: true };
      }
      default: throw new Error('未知操作。');
    }
  })().then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  void chrome.storage.session.get(null).then(all => Promise.all(Object.values(all).filter(job => job?.tabId === tabId).map(dropJob)));
});
