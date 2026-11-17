// Reconcile on worker startup as well as install/browser startup, without removing a valid menu.
export function createMenuRegistrar(api) {
  let pending;
  return () => pending ||= (async () => {
    const properties = { title: api.i18n.getMessage('menuScan'), contexts: ['image', 'page', 'frame', 'link', 'selection', 'video', 'audio'] };
    try { await api.contextMenus.update('qrcs-image', properties); }
    catch {
      await new Promise((resolve, reject) => {
        api.contextMenus.create({ id: 'qrcs-image', ...properties }, () => {
          const error = api.runtime.lastError;
          if (error) reject(new Error(error.message)); else resolve();
        });
      });
    }
  })().finally(() => { pending = undefined; });
}
