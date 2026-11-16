const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../components/${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(code, context);
  return context.exports;
}
const { DEMO_START, DEMO_MIN, DEMO_MAX, shanghaiDate, demoTokens, generateDemoUsage, buildDemoView } = load('demoUsage');
const { getWeekUsage } = load('usageSummary');

test('every day has one integer between 30 million and 1 billion, ending yesterday', () => {
  const data = generateDemoUsage('2026-11-15');
  assert.equal(data.days[0].date, DEMO_START);
  assert.equal(data.days.at(-1).date, '2026-11-14');
  assert.equal(data.days.length, (Date.parse('2026-11-15') - Date.parse(DEMO_START)) / 86400000);
  assert.equal(new Set(data.days.map(day => day.date)).size, data.days.length);
  for (const day of data.days) {
    assert.ok(Number.isInteger(day.tokens) && day.tokens >= DEMO_MIN && day.tokens <= DEMO_MAX);
    assert.ok(day.date < data.today);
  }
  assert.ok(new Set(data.days.map(day => day.tokens)).size === data.days.length);
});
test('Shanghai midnight reveals exactly one additional completed day', () => {
  const before = shanghaiDate(new Date('2026-11-14T15:59:59.999Z'));
  const after = shanghaiDate(new Date('2026-11-14T16:00:00Z'));
  assert.equal(before, '2026-11-14');
  assert.equal(after, '2026-11-15');
  const a = generateDemoUsage(before), b = generateDemoUsage(after);
  assert.equal(b.days.length, a.days.length + 1);
  assert.equal(a.cutoff, '2026-11-13');
  assert.equal(b.cutoff, '2026-11-14');
  assert.equal(JSON.stringify(a.days), JSON.stringify(b.days.slice(0, -1)));
});
test('month and year changes extend history without rerolling any earlier dates', () => {
  for (const [before, after] of [['2026-11-30', '2026-12-01'], ['2026-12-31', '2027-01-01'], ['2028-02-29', '2028-03-01']]) {
    const a = generateDemoUsage(before), b = generateDemoUsage(after);
    assert.equal(b.days.length, a.days.length + 1);
    assert.equal(JSON.stringify(a.days), JSON.stringify(b.days.slice(0, -1)));
    assert.equal(JSON.stringify(generateDemoUsage(after)), JSON.stringify(b));
  }
  assert.ok(generateDemoUsage('2028-03-01').days.some(day => day.date === '2028-02-29'));
  assert.equal(demoTokens(DEMO_START), generateDemoUsage('2035-01-01').days[0].tokens);
});
test('view rejects today and future records and includes all prior years', () => {
  const data = generateDemoUsage('2026-11-15');
  data.days.push({ date: '2026-11-15', tokens: 999 }, { date: '2027-01-01', tokens: 999 });
  const view = buildDemoView(data);
  assert.equal(view.map.has('2026-11-15'), false);
  assert.equal(view.map.has('2027-01-01'), false);
  assert.equal(view.first, '2026-06-05');
  assert.ok(view.weeks.length >= 24);
  assert.equal(view.total, data.days.filter(day => day.date < data.today).reduce((sum, day) => sum + day.tokens, 0));
});
test('year filtering keeps lifetime cumulative totals and Monday starts with zero completed days', () => {
  const data = generateDemoUsage('2027-01-10');
  const year = buildDemoView(data, '2027');
  assert.equal(year.first, '2027-01-01');
  assert.equal(year.last, '2027-01-09');
  assert.equal(year.totals.get('2027-01-02'), data.days.filter(day => day.date <= '2027-01-02').reduce((sum, day) => sum + day.tokens, 0));
  const monday = getWeekUsage(data.days.filter(day => day.date < '2026-11-16'), '2026-11-16');
  assert.equal(monday.start, '2026-11-16');
  assert.equal(monday.tokens, 0);
  assert.equal(monday.recordedDays, 0);
});
test('invalid dates fail clearly; dates before history starts have no records', () => {
  for (const date of ['2026-02-30', '2026-13-01', 'not-a-date']) assert.throws(() => generateDemoUsage(date), /Invalid calendar date/);
  assert.equal(generateDemoUsage('2026-06-04').days.length, 0);
  assert.equal(generateDemoUsage(DEMO_START).days.length, 0);
  assert.equal(buildDemoView(null).weeks.length, 0);
  assert.equal(buildDemoView(generateDemoUsage('2026-11-16'), '2026').first, DEMO_START);
  const firstDay = generateDemoUsage('2026-06-06');
  assert.equal(firstDay.days.length, 1);
  assert.equal(firstDay.days[0].date, '2026-06-05');
});
