// 宿主主题变量适配（纯函数）。
// DSH 桌面版提供 --background / --foreground / --border 等通用变量；公开版 DSH Web
// 只提供 --dsw-alias-* 设计令牌。样式里原先写成 var(--background,#fff)，在 Web 版深色主题下
// 会退回到浅色兜底值，于是插件区域保持白底。这里在兜底链中插入对应的 DSH 令牌：
//   var(--background,#fff) → var(--background,var(--dsw-alias-bg-base,#fff))
// 桌面版变量仍然优先；两者都没有时才使用原兜底值。
export const HOST_TOKEN_ALIASES = Object.freeze({
  background: '--dsw-alias-bg-base',
  foreground: '--dsw-alias-label-primary',
  border: '--dsw-alias-border-l2',
  'muted-foreground': '--dsw-alias-label-secondary',
  muted: '--dsw-alias-bg-module-platform',
  accent: '--dsw-alias-interactive-bg-hover',
  ring: '--dsw-alias-link'
});
export function adaptHostTokens(text) {
  let out = String(text);
  for (const [name, alias] of Object.entries(HOST_TOKEN_ALIASES)) {
    const pattern = new RegExp('var\\(--' + name.replace('-', '\\-') + ',([^()]*)\\)', 'g');
    out = out.replace(pattern, (_m, fallback) => `var(--${name},var(${alias},${fallback.trim()}))`);
  }
  return out;
}
// 内联样式用：hostVar('foreground','#222') → 'var(--foreground,var(--dsw-alias-label-primary,#222))'
export function hostVar(name, fallback) {
  return adaptHostTokens(`var(--${name},${fallback})`);
}
