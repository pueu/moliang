const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, globals = {}) {
  const context = { exports: {}, Intl, Date, Set, Uint32Array, Promise, ...globals };
  context.require = relative => load(path.resolve(path.dirname(file), `${relative}.ts`), globals);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, context);
  return context.exports;
}
const file = path.join(root, 'components/toys/gachaState.ts');
const { shanghaiDay, readGacha, nextDraw } = load(file);
const before = new Date('2026-10-21T15:59:59.999Z');
const after = new Date('2026-10-21T16:00:00Z');
test('Shanghai midnight refreshes exactly three draws without losing collection', () => {
  assert.equal(shanghaiDay(before), '2026-10-21');
  assert.equal(shanghaiDay(after), '2026-10-22');
  let state = readGacha(null, before);
  for (let i = 0; i < 3; i++) state = nextDraw(state, 0, before);
  assert.equal(state.used, 3);
  assert.equal(state.collection.kirby, 3);
  assert.throws(() => nextDraw(state, 0, before), /3/);
  const reloaded = readGacha(JSON.stringify(state), before);
  assert.equal(reloaded.used, 3);
  const tomorrow = readGacha(JSON.stringify(state), after);
  assert.equal(tomorrow.used, 0);
  assert.equal(tomorrow.collection.kirby, 3);
  assert.equal(tomorrow.lastDraw.characterId, 'kirby');
  assert.equal(nextDraw(tomorrow, .9999, after).used, 1);
});
test('all eight equal probability intervals select distinct characters', () => {
  const ids = new Set();
  for (let i = 0; i < 8; i++) ids.add(nextDraw(readGacha(null, before), (i + .5) / 8, before).lastDraw.characterId);
  assert.equal(ids.size, 8);
  for (const random of [-1, 1, NaN, Infinity]) assert.throws(() => nextDraw(readGacha(null, before), random, before));
});
test('unused draws never accumulate, and malformed collections are preserved as an error', () => {
  const old = nextDraw(readGacha(null, before), .2, before);
  assert.equal(readGacha(JSON.stringify(old), new Date('2026-11-01')).used, 0);
  assert.throws(() => readGacha('{broken'), /JSON/);
  assert.throws(() => readGacha(JSON.stringify({ ...old, collection: { kirby: -1 } })), /收藏/);
  assert.throws(() => readGacha(JSON.stringify({ ...old, version: 2 })), /收藏/);
});
test('storage failure rejects a draw and never reports a saved result', async () => {
  const { saveDraw } = load(file, {
    navigator: { locks: { request: (_key, callback) => callback() } },
    crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } },
  });
  await assert.rejects(saveDraw(), /QuotaExceededError/);
});
test('concurrent same-tab calls consume at most three and save one coherent snapshot', async () => {
  let saved = null;
  const { saveDraw } = load(file, {
    navigator: { locks: { request: (_key, callback) => callback() } },
    crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: () => saved, setItem: (_key, value) => { saved = value; } },
  });
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => saveDraw()));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  const state = readGacha(saved);
  assert.equal(state.used, 3);
  assert.equal(Object.values(state.collection).reduce((a, b) => a + b, 0), 3);
});
