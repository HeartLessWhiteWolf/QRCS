import { safeWebURL, selectionRect, resultKind } from './core.js';
import { ImagePipeline, loadImage } from './image-pipeline.js';

const $ = id => document.getElementById(id), params = new URL(location.href).searchParams;
document.documentElement.classList.toggle('compact', params.has('compact'));
const jobId = params.get('job');
let job, pipeline, selectedText = '', drawStart, operation = 0, wholeScreenshotFallback = false;
const request = async (type, extra = {}) => {
  const reply = await chrome.runtime.sendMessage({ type, jobId, ...extra });
  if (!reply?.ok) throw new Error(reply?.error || '扩展连接已断开，请重新打开。');
  return reply;
};
function show(id) { for (const panel of ['loading', 'select', 'result', 'error']) $(panel).hidden = panel !== id; }
function stopDecode() { pipeline?.cancel(); pipeline = null; }
function showError(message) { stopDecode(); $('error-message').textContent = message; $('error-retry').hidden = !job?.screenshot; show('error'); }
async function closeView() { operation++; stopDecode(); await request('QRCS_DROP_JOB').catch(() => {}); window.close(); }
async function decodeImage(image, rect) {
  const token = ++operation; stopDecode(); pipeline = new ImagePipeline(); show('loading');
  const results = await pipeline.decode(image, rect, text => { $('loading-detail').textContent = text; });
  if (token === operation) showResults(results);
}
function showResults(results) {
  $('result-summary').textContent = wholeScreenshotFallback
    ? `原图未能识别，以下是网页截图中找到的 ${results.length} 个不同内容，请核对目标二维码。`
    : results.length === 1 ? '请核对内容，再决定是否打开。' : `识别到 ${results.length} 个不同内容，请选择。`;
  const tabs = $('result-tabs'); tabs.replaceChildren();
  const choose = index => {
    selectedText = results[index].text;
    $('content').textContent = selectedText || '（二进制数据）\n' + results[index].binary.map(x => x.toString(16).padStart(2, '0')).join(' ');
    $('kind').textContent = selectedText ? resultKind(selectedText) : '二进制数据';
    $('char-count').textContent = `${Array.from(selectedText).length} 字符`;
    const url = safeWebURL(selectedText); $('open').disabled = !url;
    $('url-note').textContent = url ? '在新标签页打开：' + new URL(url).hostname : '此内容可复制使用。';
    $('feedback').textContent = ''; $('copy').disabled = !selectedText;
    [...tabs.children].forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
  };
  if (results.length > 1) results.forEach((_result, index) => {
    const button = document.createElement('button'); button.textContent = '结果 ' + (index + 1); button.onclick = () => choose(index); tabs.append(button);
  });
  $('retry').hidden = !job.screenshot; choose(0); show('result');
}
async function showSelection() {
  operation++; stopDecode(); drawStart = undefined; wholeScreenshotFallback = false;
  if (!job?.screenshot) { showError('没有可用截图，请回到网页重新点击插件图标。'); return; }
  $('selection-box').style.display = 'none'; $('screenshot').src = job.screenshot;
  $('select-hint').textContent = '拖动框住二维码，松开识别。'; show('select'); $('stage').focus();
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
  if (!drawStart) return; const bounds = stage.getBoundingClientRect();
  const rect = selectionRect(drawStart, localPoint(event), bounds.width, bounds.height); drawStart = undefined;
  if (!rect) { $('selection-box').style.display = 'none'; $('select-hint').textContent = '选区太小，请重新拖动框住整个二维码。'; return; }
  void loadImage(job.screenshot).then(image => decodeImage(image, rect)).catch(error => showError(error.message));
});
window.addEventListener('resize', () => { drawStart = undefined; $('selection-box').style.display = 'none'; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') void closeView(); });
for (const id of ['cancel', 'error-cancel', 'select-cancel']) $(id).onclick = closeView;
for (const id of ['retry', 'error-retry']) $(id).onclick = showSelection;
$('open').onclick = async () => {
  if (!safeWebURL(selectedText)) return; $('open').disabled = true;
  try { await request('QRCS_OPEN_URL', { url: selectedText }); await closeView(); }
  catch (error) { $('feedback').textContent = error.message; $('open').disabled = false; }
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(selectedText); $('feedback').textContent = '已复制内容'; }
  catch { $('feedback').textContent = '请选中上方内容后按 Ctrl+C。'; }
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
