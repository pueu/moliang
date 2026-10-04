import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOfficialUsage } from './official-usage.mjs';

test('only dated totals reach the public response; private fields are discarded', () => {
  const result = normalizeOfficialUsage({
    account: { email: 'private@example.invalid' }, accessToken: 'must-not-be-returned',
    summary: { lifetimeTokens: 999 },
    dailyUsageBuckets: [{ startDate: '2026-10-03', tokens: 3, sessionId: 'private' }, { startDate: '2026-10-03', tokens: 4 }],
  }, '2026-10-04T00:00:00Z');
  assert.deepEqual(result.days, [{ date: '2026-10-03', tokens: 7 }]);
  assert.deepEqual(Object.keys(result).sort(), ['days', 'source', 'updatedAt']);
  assert.doesNotMatch(JSON.stringify(result), /private|must-not|lifetime/);
});
test('missing daily buckets remain unavailable rather than becoming zero activity', () => {
  assert.throws(() => normalizeOfficialUsage({ dailyUsageBuckets: null }), { code: 'daily_usage_unavailable' });
  assert.deepEqual(normalizeOfficialUsage({ dailyUsageBuckets: [] }).days, []);
});
test('rejects impossible dates, negative counters, and unsafe merged totals', () => {
  for (const bucket of [{ startDate: '2026-02-30', tokens: 1 }, { startDate: '2026-10-03', tokens: -1 }]) {
    assert.throws(() => normalizeOfficialUsage({ dailyUsageBuckets: [bucket] }), { code: 'invalid_daily_usage' });
  }
  assert.throws(() => normalizeOfficialUsage({ dailyUsageBuckets: [{ startDate: '2026-10-03', tokens: Number.MAX_SAFE_INTEGER }, { startDate: '2026-10-03', tokens: 1 }] }), { code: 'invalid_daily_usage' });
});
