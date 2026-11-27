import test from 'node:test';
import assert from 'node:assert/strict';

test('date helpers reuse one Intl.DateTimeFormat instead of constructing one per call', async () => {
  const Original = Intl.DateTimeFormat;
  let constructed = 0;
  Intl.DateTimeFormat = function (...args) {
    constructed++;
    return new Original(...args);
  };
  try {
    const { shanghaiDateKey } = await import('./dates.js?count');
    const { formatChatDayKey, formatChatTimestamp } = await import('../workspace.js?count');
    const before = constructed;
    for (let i = 0; i < 500; i++) {
      shanghaiDateKey(1793358084 + i * 3600);
      formatChatDayKey(1793358084 + i * 3600);
      formatChatTimestamp(1793358084 + i * 3600);
    }
    assert.equal(constructed - before, 0, '逐条调用时不应再新建 Intl.DateTimeFormat');
  } finally {
    Intl.DateTimeFormat = Original;
  }
});

test('cached formatter keeps the Shanghai calendar day', async () => {
  const { shanghaiDateKey } = await import('./dates.js');
  assert.equal(shanghaiDateKey('2026-10-30T18:00:00Z'), '2026-10-31');
  assert.equal(shanghaiDateKey('2026-10-30 23:59:59'), '2026-10-30');
  assert.equal(shanghaiDateKey(1793358084), '2026-10-30');
  assert.equal(shanghaiDateKey(''), null);
});
