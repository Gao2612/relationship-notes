import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptHostTokens, hostVar } from './host-tokens.js';
import { css, hostCss } from './workspace.js';

test('host variables keep priority and gain DSH Web aliases before the literal fallback', () => {
  assert.equal(
    adaptHostTokens('a{color:var(--foreground,#222);background:var(--background,#fff)}'),
    'a{color:var(--foreground,var(--dsw-alias-label-primary,#222));background:var(--background,var(--dsw-alias-bg-base,#fff))}'
  );
  assert.equal(hostVar('muted-foreground', '#777'), 'var(--muted-foreground,var(--dsw-alias-label-secondary,#777))');
  // --muted must not swallow --muted-foreground
  assert.equal(
    adaptHostTokens('var(--muted,#fafafa) var(--muted-foreground,#777)'),
    'var(--muted,var(--dsw-alias-bg-module-platform,#fafafa)) var(--muted-foreground,var(--dsw-alias-label-secondary,#777))'
  );
  assert.equal(
    adaptHostTokens(adaptHostTokens('var(--border,#ddd)')),
    adaptHostTokens('var(--border,#ddd)'),
    'idempotent'
  );
});

test('the stylesheet the plugin mounts has no host variable that falls straight back to a light literal', () => {
  assert.match(css, /var\(--background,#fff\)/);
  assert.doesNotMatch(hostCss, /var\(--(?:background|foreground|border|muted|muted-foreground|accent|ring),#/);
  assert.match(hostCss, /--rn-bg:var\(--background,var\(--dsw-alias-bg-base,#fff\)\)/);
});
