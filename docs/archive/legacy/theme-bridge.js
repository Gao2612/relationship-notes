// One-way appearance bridge only. Never send data or messages to the parent.
(() => {
  const allowed = new Set(['--paper','--ink','--muted','--line','--accent','--soft','--mint','--control','--accent-ink','--warn','--red']);
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'relationship-theme-v1') return;
    const values = event.data.values;
    if (!values || typeof values !== 'object') return;
    for (const [key, value] of Object.entries(values)) {
      if (allowed.has(key) && typeof value === 'string' && value.length < 160 && CSS.supports('color', value)) document.documentElement.style.setProperty(key, value);
    }
    if (['light','dark'].includes(event.data.scheme)) document.documentElement.style.colorScheme = event.data.scheme;
  });
  document.querySelector('.sidebar .foot').lastChild.textContent = '本地隔离视图 · 不读取 DSH 会话';
})();
