// Injected only after an explicit toolbar click. All UI lives in a shadow root.
(() => {
  if (globalThis.__qrcsSelectionInstalled) return;
  globalThis.__qrcsSelectionInstalled = true;
  let closeCurrent;
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message.type === 'QRCS_CLOSE_OVERLAY') { closeCurrent?.(); reply({ ok: true }); }
    if (message.type !== 'QRCS_SELECT') return;
    closeCurrent?.();
    const host = document.createElement('qrcs-selection');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      :host{color-scheme:light}*{box-sizing:border-box} .screen{position:fixed;inset:0;cursor:crosshair;touch-action:none;user-select:none;background:#111}
      img{position:absolute;width:100%;height:100%;pointer-events:none} .shade{position:absolute;inset:0;background:#101b2c66;pointer-events:none}
      .box{display:none;position:absolute;border:2px solid #53dfd0;box-shadow:0 0 0 99999px #101b2c66;pointer-events:none}
      .tip{position:absolute;left:50%;top:24px;transform:translateX(-50%);padding:13px 20px;border-radius:12px;background:#12212f;box-shadow:0 5px 30px #0004;color:#fff;font:15px/1.5 'Microsoft YaHei',sans-serif;white-space:nowrap;pointer-events:none}
      button{position:absolute;right:24px;top:24px;background:white;color:#172c3b;border:0;border-radius:10px;padding:11px 20px;font:14px 'Microsoft YaHei',sans-serif;cursor:pointer}
    </style><div class="screen" tabindex="0" role="dialog" aria-label="框选二维码，按 Esc 取消"><img alt="当前网页截图"><div class="shade"></div><div class="box"></div><div class="tip">拖动框住二维码 · 松开识别 · Esc 取消</div><button type="button">取消</button></div>`;
    const screen = root.querySelector('.screen'), box = root.querySelector('.box'), shade = root.querySelector('.shade');
    root.querySelector('img').src = message.screenshot;
    const previousFocus = document.activeElement;
    document.documentElement.append(host);
    screen.focus({ preventScroll: true });
    let start;
    let finished = false;
    const send = payload => chrome.runtime.sendMessage({ ...payload, jobId: message.jobId }).catch(() => {});
    const cleanup = () => {
      host.remove(); window.removeEventListener('resize', cancel); window.removeEventListener('pagehide', cancel);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      if (closeCurrent === cancel) closeCurrent = undefined;
    };
    const cancel = () => {
      if (finished) return;
      finished = true; cleanup(); void send({ type: 'QRCS_CANCEL_OVERLAY' });
    };
    closeCurrent = cancel;
    window.addEventListener('resize', cancel, { once: true }); window.addEventListener('pagehide', cancel, { once: true });
    root.querySelector('button').onclick = cancel;
    screen.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); cancel(); }
      if (event.key === 'Tab') event.preventDefault();
    });
    screen.addEventListener('contextmenu', event => event.preventDefault());
    screen.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.tagName === 'BUTTON') return;
      event.preventDefault(); start = { x: event.clientX, y: event.clientY };
      screen.setPointerCapture(event.pointerId); box.style.display = 'block'; shade.style.display = 'none';
      Object.assign(box.style, { left: start.x + 'px', top: start.y + 'px', width: '0px', height: '0px' });
    });
    screen.addEventListener('pointermove', event => {
      if (!start) return;
      Object.assign(box.style, { left: Math.min(start.x, event.clientX) + 'px', top: Math.min(start.y, event.clientY) + 'px',
        width: Math.abs(start.x - event.clientX) + 'px', height: Math.abs(start.y - event.clientY) + 'px' });
    });
    screen.addEventListener('pointercancel', () => { start = undefined; box.style.display = 'none'; shade.style.display = 'block'; });
    screen.addEventListener('pointerup', event => {
      if (!start || finished) return;
      const w = innerWidth, h = innerHeight;
      const x = Math.max(0, Math.min(w, Math.min(start.x, event.clientX)));
      const y = Math.max(0, Math.min(h, Math.min(start.y, event.clientY)));
      const width = Math.min(w, Math.max(start.x, event.clientX)) - x;
      const height = Math.min(h, Math.max(start.y, event.clientY)) - y;
      start = undefined;
      if (width < 8 || height < 8) {
        box.style.display = 'none'; shade.style.display = 'block';
        root.querySelector('.tip').textContent = '选区太小，请把二维码连同四周留白一起框住'; return;
      }
      finished = true; cleanup();
      void send({ type: 'QRCS_CROP', rect: { x: x / w, y: y / h, width: width / w, height: height / h } });
    });
    reply({ ok: true });
  });
})();
