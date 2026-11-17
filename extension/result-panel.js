// A compact in-page panel; result presentation creates no browser window/tab.
(() => {
  if (globalThis.__qrcsResultInstalled) return;
  globalThis.__qrcsResultInstalled = true;
  let current;
  function create(message) {
    current?.close();
    const host = document.createElement('qrcs-result');
    host.lang = chrome.i18n.getMessage('uiLanguage');
    host.style.cssText = 'all:initial!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;z-index:2147483647!important;width:min(420px,calc(100vw - 28px))!important;display:block!important;color-scheme:light!important;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      *{box-sizing:border-box}[hidden]{display:none!important}.card{font:14px/1.55 'Microsoft YaHei',system-ui,sans-serif;color:#203b4b;background:#fff;border:1px solid #dce7e9;border-radius:14px;box-shadow:0 15px 65px #102f3c38;padding:18px 20px;max-height:calc(100vh - 36px);overflow:auto}
      header{display:flex;align-items:center;justify-content:space-between;gap:12px}strong{font-size:15px}small{font-size:11px;color:#73908f}button{font:inherit;border:1px solid transparent;border-radius:7px;padding:8px 16px;cursor:pointer;background:#eff4f5;color:#41606c}button:hover{filter:brightness(.97)}button:disabled{opacity:.4;cursor:default}button:focus-visible,pre:focus-visible{outline:2px solid #42b8aa;outline-offset:3px}.x{background:none;font-size:22px;line-height:1;padding:0 0 0 8px;color:#8b9a9f}
      h2{font-size:17px;margin:14px 0 5px}p{font-size:12px;color:#6f858f;margin:5px 0 12px;overflow-wrap:anywhere}.tag{font-size:11px;color:#087e81;margin-bottom:5px}pre{font:13px/1.7 Consolas,'Microsoft YaHei',monospace;background:#f5f8f9;border:1px solid #e0e9ec;padding:11px;border-radius:8px;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:min(180px,35vh);min-height:50px;overflow:auto;user-select:text}.actions{display:flex;gap:8px;margin-top:15px;flex-wrap:wrap}.primary{background:#087e81;color:#fff}.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0}.tabs button{font-size:11px;padding:4px 9px}.tabs button[aria-pressed=true]{background:#def3ed;color:#13796c}.retry{background:none;font-size:12px;color:#087e81;padding:10px 0 0}.feedback{font-size:11px;color:#087e81;margin:3px 0 0}.spinner{display:inline-block;width:12px;height:12px;border:2px solid #d7efeb;border-top-color:#087e81;border-radius:50%;margin-right:7px;vertical-align:-1px;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
    </style><section class="card" role="dialog"><header><strong>QRCS <small data-i18n="panelSubtitle"></small></strong><button class="x">×</button></header><h2 id="title"><i class="spinner"></i><span data-i18n="decoding"></span></h2><p id="summary" data-i18n="pleaseWait"></p><div id="tabs" class="tabs"></div><div id="kind" class="tag" hidden></div><pre id="content" tabindex="0" hidden></pre><div class="actions"><button id="open" class="primary" hidden data-i18n="open"></button><button id="copy" hidden data-i18n="copy"></button><button id="cancel" data-i18n="cancel"></button></div><button id="retry" class="retry" hidden data-i18n="retrySelection"></button><p id="feedback" class="feedback" role="status"></p></section>`;
    for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = chrome.i18n.getMessage(element.dataset.i18n);
    root.querySelector('.card').setAttribute('aria-label', chrome.i18n.getMessage('extensionName'));
    root.querySelector('.x').setAttribute('aria-label', chrome.i18n.getMessage('close'));
    const $ = id => root.getElementById(id), previousFocus = document.activeElement;
    let text = '', url, results = [], closed = false;
    const request = async (type, extra = {}) => {
      const result = await chrome.runtime.sendMessage({ type, jobId: message.jobId, ...extra });
      if (!result?.ok) throw new Error(result?.error || chrome.i18n.getMessage('errorDisconnected'));
      return result;
    };
    const close = () => {
      if (closed) return;
      closed = true; host.remove(); document.removeEventListener('keydown', key, true); window.removeEventListener('pagehide', close);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      void request('QRCS_DROP_JOB').catch(() => {});
      if (current?.host === host) current = null;
    };
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true); window.addEventListener('pagehide', close, { once: true });
    root.querySelector('.x').onclick = close; $('cancel').onclick = close;
    $('open').onclick = async () => {
      $('open').disabled = true;
      try { await request('QRCS_OPEN_URL', { url: text }); close(); }
      catch (error) { $('feedback').textContent = error.message; $('open').disabled = false; }
    };
    $('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(text); $('feedback').textContent = chrome.i18n.getMessage('copied'); }
      catch {
        const field = document.createElement('textarea'); field.value = text; root.append(field); field.select();
        const copied = document.execCommand('copy'); field.remove(); $('copy').focus();
        $('feedback').textContent = copied ? chrome.i18n.getMessage('copied') : chrome.i18n.getMessage('copyManually');
      }
    };
    $('retry').onclick = async () => { try { await request('QRCS_RETRY'); close(); } catch (error) { $('feedback').textContent = error.message; } };
    const choose = index => {
      const result = results[index]; text = result.text; url = result.url;
      $('content').textContent = text || chrome.i18n.getMessage('binaryContent', result.binary.map(x => x.toString(16).padStart(2, '0')).join(' '));
      $('kind').textContent = url ? chrome.i18n.getMessage('webLinkHost', new URL(url).hostname) : chrome.i18n.getMessage('qrContent');
      $('open').disabled = !url; $('copy').disabled = !text; $('feedback').textContent = '';
      [...$('tabs').children].forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    };
    const update = data => {
      if (closed) return;
      $('retry').hidden = !message.canRetry;
      if (data.error) { $('title').textContent = chrome.i18n.getMessage('noCodeTitle'); $('summary').textContent = data.error; return; }
      results = data.results;
      if (!results?.length) return;
      $('title').textContent = chrome.i18n.getMessage('success');
      $('summary').textContent = data.wholeScreenshotFallback ? chrome.i18n.getMessage('screenshotResults') : results.length > 1 ? chrome.i18n.getMessage('multipleResults', String(results.length)) : chrome.i18n.getMessage('checkBeforeOpening');
      for (const id of ['kind', 'content', 'open', 'copy']) $(id).hidden = false;
      $('tabs').replaceChildren();
      if (results.length > 1) results.forEach((_, i) => { const button = document.createElement('button'); button.textContent = chrome.i18n.getMessage('resultNumber', String(i + 1)); button.onclick = () => choose(i); $('tabs').append(button); });
      choose(0);
    };
    document.documentElement.append(host); $('cancel').focus({ preventScroll: true });
    current = { host, jobId: message.jobId, close, update };
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'QRCS_CLOSE_RESULT') { current?.close(); respond({ ok: true }); }
    if (message.type === 'QRCS_SHOW_RESULT') { create(message); respond({ ok: true }); }
    if (message.type === 'QRCS_UPDATE_RESULT' && current?.jobId === message.jobId) { current.update(message); respond({ ok: true }); }
  });
})();
