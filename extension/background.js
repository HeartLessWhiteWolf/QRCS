import { getOffscreenMessages } from './i18n.js';
import { safeWebURL, pixelRect } from './core.js';
import { createMenuRegistrar } from './context-menu.js';

const MENU = 'qrcs-image', PREFIX = 'qrcs-job-', MAX_AGE = 30 * 60 * 1000;
const scanning = new Set();
let creatingOffscreen;
const registerMenu = createMenuRegistrar(chrome);
const restoreMenu = () => { void registerMenu().catch(error => console.error(chrome.i18n.getMessage('menuRegistrationFailed'), error)); };
chrome.runtime.onInstalled.addListener(restoreMenu);
chrome.runtime.onStartup.addListener(restoreMenu);
restoreMenu();
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
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new Error(chrome.i18n.getMessage('errorInvalidJob'));
  const job = (await chrome.storage.session.get(PREFIX + id))[PREFIX + id];
  if (!job || Date.now() - job.created > MAX_AGE) throw new Error(chrome.i18n.getMessage('errorExpiredJob'));
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
    creatingOffscreen ||= chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['WORKERS', 'BLOBS'], justification: chrome.i18n.getMessage('offscreenJustification') }).finally(() => { creatingOffscreen = null; });
    await creatingOffscreen;
  }
  const result = await chrome.runtime.sendMessage({ target: 'qrcs-offscreen', type: 'QRCS_DECODE_JOB', job, messages: getOffscreenMessages() });
  if (!result?.ok) throw new Error(result?.error || chrome.i18n.getMessage('errorDecode'));
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
    if (!reply?.ok) throw new Error(chrome.i18n.getMessage('errorPanel'));
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
    if (active?.id !== tab.id) throw new Error(chrome.i18n.getMessage('errorTabChanged'));
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
      if (!reply?.ok) throw new Error(chrome.i18n.getMessage('errorSelectionUnavailable'));
    } catch { await toolbarView(job); }
  } catch (error) {
    await presentJob(await createJob(tab, { mode: 'error', error: chrome.i18n.getMessage('errorCapture', error.message) }));
  } finally { scanning.delete(tab.id); }
}
export async function beginImage(info, tab) {
  await clearUI(tab.id);
  let screenshot;
  try { screenshot = await capture(tab); } catch { /* Original image remains usable. */ }
  const imageUrl = info.srcUrl;
  const valid = typeof imageUrl === 'string' && /^(https?:|data:image\/|blob:)/i.test(imageUrl);
  await presentJob(await createJob(tab, valid ? { mode: 'image', imageUrl, screenshot }
    : { mode: 'error', error: chrome.i18n.getMessage('errorImageUnavailable'), screenshot }));
}
chrome.action.onClicked.addListener(tab => { void beginSelection(tab); });
export async function handleContextMenu(info, tab) {
  if (info.menuItemId !== MENU || !tab) return;
  if (info.mediaType === 'image' && info.srcUrl) await beginImage(info, tab);
  else await beginSelection(tab);
}
chrome.contextMenus.onClicked.addListener((info, tab) => { void handleContextMenu(info, tab); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || message.target === 'qrcs-offscreen' || !message.type?.startsWith('QRCS_')) return;
  const internal = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('scanner.html'));
  void (async () => {
    const job = await getJob(message.jobId);
    const ownPage = sender.id === chrome.runtime.id && sender.tab?.id === job.tabId && sender.frameId === 0;
    if (!internal && !ownPage) throw new Error(chrome.i18n.getMessage('errorRequestSource'));
    switch (message.type) {
      case 'QRCS_CROP':
        if (!ownPage) throw new Error(chrome.i18n.getMessage('errorJobPage'));
        pixelRect(message.rect, 1000, 1000); job.mode = 'crop'; job.rect = message.rect;
        await saveJob(job); void presentJob(job); return { ok: true };
      case 'QRCS_GET_JOB':
        if (!internal) throw new Error(chrome.i18n.getMessage('errorJobRead'));
        return { ok: true, job };
      case 'QRCS_CANCEL_OVERLAY':
      case 'QRCS_DROP_JOB': await dropJob(job); return { ok: true };
      case 'QRCS_RETRY':
        await dropJob(job); void beginSelection(await chrome.tabs.get(job.tabId)); return { ok: true };
      case 'QRCS_OPEN_URL': {
        const url = safeWebURL(message.url);
        if (!url) throw new Error(chrome.i18n.getMessage('errorWebURL'));
        await chrome.tabs.create({ url, windowId: job.windowId, active: true }); return { ok: true };
      }
      default: throw new Error(chrome.i18n.getMessage('errorUnknownOperation'));
    }
  })().then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  void chrome.storage.session.get(null).then(all => Promise.all(Object.values(all).filter(job => job?.tabId === tabId).map(dropJob)));
});
