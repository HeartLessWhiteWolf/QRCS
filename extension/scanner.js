import { getMessage, localize } from './i18n.js';
import { safeWebURL, selectionRect, resultKind } from './core.js';
import { ImagePipeline, loadImage } from './image-pipeline.js';

document.documentElement.lang = getMessage('uiLanguage');
localize();
const $ = id => document.getElementById(id), params = new URL(location.href).searchParams;
document.documentElement.classList.toggle('compact', params.has('compact'));
const jobId = params.get('job');
let job, pipeline, selectedText = '', drawStart, operation = 0, wholeScreenshotFallback = false;
const request = async (type, extra = {}) => {
  const reply = await chrome.runtime.sendMessage({ type, jobId, ...extra });
  if (!reply?.ok) throw new Error(reply?.error || getMessage('errorScannerDisconnected'));
  return reply;
};
function show(id) { for (const panel of ['loading', 'select', 'result', 'error']) $(panel).hidden = panel !== id; }
function stopDecode() { pipeline?.cancel(); pipeline = null; }
function showError(message) { stopDecode(); $('error-message').textContent = message; $('error-retry').hidden = !job?.screenshot; show('error'); }
async function closeView() { drawStart = undefined; operation++; stopDecode(); await request('QRCS_DROP_JOB').catch(() => {}); window.close(); }
async function decodeImage(image, rect) {
  const token = ++operation; stopDecode(); pipeline = new ImagePipeline(); show('loading');
  const results = await pipeline.decode(image, rect, text => { $('loading-detail').textContent = text; });
  if (token === operation) showResults(results);
}
function showResults(results) {
  $('result-summary').textContent = wholeScreenshotFallback
    ? getMessage('scannerScreenshotResults', String(results.length))
    : results.length === 1 ? getMessage('scannerCheckBeforeOpening') : getMessage('scannerMultipleResults', String(results.length));
  const tabs = $('result-tabs'); tabs.replaceChildren();
  const choose = index => {
    selectedText = results[index].text;
    $('content').textContent = selectedText || getMessage('binaryContent', results[index].binary.map(x => x.toString(16).padStart(2, '0')).join(' '));
    $('kind').textContent = selectedText ? resultKind(selectedText) : getMessage('binaryData');
    $('char-count').textContent = getMessage('characterCount', String(Array.from(selectedText).length));
    const url = safeWebURL(selectedText); $('open').disabled = !url;
    $('url-note').textContent = url ? getMessage('openHost', new URL(url).hostname) : getMessage('contentCopyable');
    $('feedback').textContent = ''; $('copy').disabled = !selectedText;
    [...tabs.children].forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
  };
  if (results.length > 1) results.forEach((_result, index) => {
    const button = document.createElement('button'); button.textContent = getMessage('resultNumber', String(index + 1)); button.onclick = () => choose(index); tabs.append(button);
  });
  $('retry').hidden = !job.screenshot; choose(0); show('result');
}
async function showSelection() {
  operation++; stopDecode(); drawStart = undefined; wholeScreenshotFallback = false;
  if (!job?.screenshot) { showError(getMessage('errorNoScreenshot')); return; }
  $('selection-box').style.display = 'none'; $('screenshot').src = job.screenshot;
  $('select-hint').textContent = getMessage('selectionHint'); show('select'); $('stage').focus();
}
const stage = $('stage');
const localPoint = event => {
  const bounds = stage.getBoundingClientRect();
  return { x: Math.min(bounds.width, Math.max(0, event.clientX - bounds.left)), y: Math.min(bounds.height, Math.max(0, event.clientY - bounds.top)) };
};
stage.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault(); drawStart = localPoint(event); stage.setPointerCapture(event.pointerId);
  Object.assign($('selection-box').style, { display: 'block', left: drawStart.x + 'px', top: drawStart.y + 'px', width: '0px', height: '0px' });
});
stage.addEventListener('pointermove', event => {
  if (!drawStart) return; const point = localPoint(event);
  Object.assign($('selection-box').style, { left: Math.min(drawStart.x, point.x) + 'px', top: Math.min(drawStart.y, point.y) + 'px', width: Math.abs(drawStart.x - point.x) + 'px', height: Math.abs(drawStart.y - point.y) + 'px' });
});
stage.addEventListener('pointercancel', () => { drawStart = undefined; $('selection-box').style.display = 'none'; });
stage.addEventListener('pointerup', event => {
  if (event.button !== 0 || !drawStart) return; const bounds = stage.getBoundingClientRect();
  const rect = selectionRect(drawStart, localPoint(event), bounds.width, bounds.height); drawStart = undefined;
  if (!rect) { $('selection-box').style.display = 'none'; $('select-hint').textContent = getMessage('selectionRetrySmall'); return; }
  void loadImage(job.screenshot).then(image => decodeImage(image, rect)).catch(error => showError(error.message));
});
window.addEventListener('resize', () => { drawStart = undefined; $('selection-box').style.display = 'none'; });
document.addEventListener('contextmenu', event => {
  if ($('select').hidden) return;
  event.preventDefault(); event.stopPropagation(); void closeView();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') void closeView(); });
for (const id of ['cancel', 'error-cancel', 'select-cancel']) $(id).onclick = closeView;
for (const id of ['retry', 'error-retry']) $(id).onclick = showSelection;
$('open').onclick = async () => {
  if (!safeWebURL(selectedText)) return; $('open').disabled = true;
  try { await request('QRCS_OPEN_URL', { url: selectedText }); await closeView(); }
  catch (error) { $('feedback').textContent = error.message; $('open').disabled = false; }
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(selectedText); $('feedback').textContent = getMessage('copied'); }
  catch { $('feedback').textContent = getMessage('scannerCopyManually'); }
};
window.addEventListener('pagehide', () => { stopDecode(); void request('QRCS_DROP_JOB').catch(() => {}); });
try {
  job = (await request('QRCS_GET_JOB')).job;
  if (job.mode === 'error') showError(job.error);
  else if (job.mode === 'select') await showSelection();
  else if (job.mode === 'crop') await decodeImage(await loadImage(job.screenshot), job.rect);
  else {
    pipeline = new ImagePipeline();
    const result = await pipeline.run(job, text => { $('loading-detail').textContent = text; });
    wholeScreenshotFallback = result.wholeScreenshotFallback; showResults(result.results);
  }
} catch (error) { showError(error.message); }
