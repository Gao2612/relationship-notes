window.__ModuleLoader__.load({
  id: '@local/relationship-notes',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const workspace = /*__WORKSPACE_HTML__*/null;
    const dictionaries = /*__LOCALES__*/null;
    const panelId = 'local-relationship-notes';
    const tokens = {
      '--paper': '--dsw-alias-bg-base', '--control': '--dsw-alias-bg-layer-1',
      '--soft': '--dsw-alias-bg-layer-1', '--mint': '--dsw-alias-bg-layer-2',
      '--ink': '--dsw-alias-label-primary', '--muted': '--dsw-alias-label-secondary',
      '--line': '--dsw-alias-border-l1', '--accent': '--dsw-alias-brand-primary',
      '--accent-ink': '--dsw-alias-bg-base', '--warn': '--dsw-alias-state-warn-primary',
      '--red': '--dsw-alias-state-error-primary',
    };
    function Icon({ size = 20 }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M5 3h15v18H5zM3 7h4M3 12h4M3 17h4M10 17h5M10 8c0-2 3-2 3-1 1-2 4-1 3 1 0 2-3 4-3 4s-3-2-3-4Z' }));
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale;
        const t = locale.bind(panelId);
        ctx.effect(() => Object.entries(dictionaries).map(([language, dict]) => locale.register(panelId, language, dict)));
        function Page() {
          const container = React.useRef(null);
          const frame = React.useRef(null);
          const [ready, setReady] = React.useState(false);
          const [, setRevision] = React.useState(0);
          React.useEffect(() => locale.subscribe(() => setRevision(n => n + 1)), []);
          const sendTheme = React.useCallback(() => {
            if (!container.current || !frame.current?.contentWindow) return;
            const style = getComputedStyle(container.current);
            const values = {};
            for (const [key, token] of Object.entries(tokens)) {
              const color = style.getPropertyValue(token).trim();
              if (color && color.length < 160 && CSS.supports('color', color)) values[key] = color;
            }
            // Opaque sandbox origin requires '*'; payload contains only public theme colors.
            const rgb = style.backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
            const dark = rgb?.length === 3 ? (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) < 128000 : matchMedia('(prefers-color-scheme: dark)').matches;
            frame.current.contentWindow.postMessage({ type: 'relationship-theme-v1', values, scheme: dark ? 'dark' : 'light' }, '*');
          }, []);
          React.useEffect(() => {
            const observer = new MutationObserver(sendTheme);
            for (let node = container.current; node; node = node.parentElement) observer.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] });
            const media = matchMedia('(prefers-color-scheme: dark)');
            media.addEventListener('change', sendTheme);
            sendTheme();
            return () => { observer.disconnect(); media.removeEventListener('change', sendTheme); };
          }, [sendTheme]);
          return h('section', { ref: container, 'aria-label': t('nav'), style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)' } },
            h('header', { style: { padding: '12px 20px', borderBottom: '1px solid var(--dsw-alias-border-l1)', flexShrink: 0 } },
              h('h1', { style: { fontSize: 18, margin: '0 0 4px', fontWeight: 600 } }, t('nav')),
              h('p', { style: { margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, t('privacy')),
              h('p', { style: { margin: '4px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('workspaceLanguage'))),
            !ready ? h('p', { role: 'status', style: { padding: '0 20px' } }, t('loading')) : null,
            h('iframe', { ref: frame, title: t('open'), srcDoc: workspace, sandbox: 'allow-scripts allow-downloads', referrerPolicy: 'no-referrer', onLoad: () => { sendTheme(); setReady(true); }, style: { display: 'block', border: 0, width: '100%', flex: '1 1 0%', minHeight: 240 } }));
        }
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: panelId }, Page)));
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: panelId, order: 55, label: () => t('nav') }, Icon)));
      },
    };
  },
});
