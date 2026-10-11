const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/usageSummary.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { formatTokens, getWeekUsage } = context.exports;

test('large token counts use one decimal and Chinese units', () => {
  assert.equal(formatTokens(110_000_000), '1.1亿token');
  assert.equal(formatTokens(10_001_000), '1000.1万token');
  assert.equal(formatTokens(10_000), '1.0万token');
  assert.equal(formatTokens(99_999_999), '1.0亿token');
  assert.equal(formatTokens(0), '0token');
});

test('Sunday summary includes Monday through Sunday, excluding previous and next weeks', () => {
  const result = getWeekUsage([
    { date: '2026-10-04', tokens: 99 },
    { date: '2026-10-05', tokens: 10 },
    { date: '2026-10-10', tokens: 20 },
    { date: '2026-10-11', tokens: 30 },
    { date: '2026-10-12', tokens: 99 },
  ], '2026-10-11');
  assert.equal(result.start, '2026-10-05');
  assert.equal(result.end, '2026-10-11');
  assert.equal(result.tokens, 60);
  assert.equal(result.recordedDays, 3);
});

test('Monday starts a new week and ignores future records', () => {
  const result = getWeekUsage([
    { date: '2026-10-11', tokens: 99 },
    { date: '2026-10-12', tokens: 0 },
    { date: '2026-10-13', tokens: 99 },
  ], '2026-10-12');
  assert.equal(result.start, '2026-10-12');
  assert.equal(result.end, '2026-10-18');
  assert.equal(result.tokens, 0);
  assert.equal(result.recordedDays, 1);
});

test('week spans the year boundary; missing data stays unrecorded', () => {
  const result = getWeekUsage([{ date: '2026-12-31', tokens: 100 }], '2027-01-01');
  assert.equal(result.start, '2026-12-28');
  assert.equal(result.end, '2027-01-03');
  assert.equal(result.tokens, 100);
  assert.equal(getWeekUsage([], '2027-01-01').recordedDays, 0);
});
