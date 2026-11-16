async page => {
  const browser = page.context().browser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await context.addInitScript(() => {
    const RealDate = Date;
    window.__demoNow = RealDate.parse('2026-11-15T04:00:00Z');
    // Override calendar construction only; keep real timers/Date.now for UI QA.
    window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [window.__demoNow])); } };
  });
  const p = await context.newPage();
  const usageRequests = [];
  const errors = [];
  p.on('request', request => { if (/codex-usage|\/api\/.*usage/.test(request.url())) usageRequests.push(request.url()); });
  p.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:3100/moliang/';
  try {
    await p.goto(url);
    const panel = p.getByTestId('codex-usage');
    await p.waitForFunction(() => document.querySelector('[data-testid="codex-usage"]')?.dataset.today === '2026-11-15');
    await panel.scrollIntoViewIfNeeded();
    await p.getByTestId('usage-grid').waitFor();
    const read = () => panel.locator('[data-usage-date]').evaluateAll(cells => cells.map(cell => ({ date: cell.dataset.usageDate, tokens: Number(cell.dataset.tokens) })));
    const first = await read();
    assert(first[0].date === '2026-06-05' && first.at(-1).date === '2026-11-14', 'full history ends yesterday');
    assert(first.every(day => day.date < '2026-11-15' && day.tokens >= 30000000 && day.tokens <= 1000000000), 'date and value bounds');
    assert(await panel.getAttribute('data-usage-source') === 'demo', 'demo source labelled');
    assert((await panel.innerText()).includes('Codex 用量') && !/演示|随机|非真实/.test(await panel.innerText()), 'requested usage labels');
    assert(await p.getByTestId('usage-grid').evaluate(el => el.scrollLeft + el.clientWidth >= el.scrollWidth - 2), 'history starts scrolled to latest');
    await p.reload();
    await p.getByTestId('usage-grid').waitFor();
    assert(JSON.stringify(first) === JSON.stringify(await read()), 'refresh never rerolls history');
    results.push('full history, 30m–1b bounds, yesterday cutoff, stable refresh: passed');

    await panel.locator('[data-usage-date="2026-11-14"]').hover();
    await p.getByRole('tooltip').waitFor();
    assert((await p.getByRole('tooltip').innerText()).includes('2026-11-14'), 'tooltip date');
    await p.keyboard.press('Escape');
    await p.getByRole('combobox', { name: '用量展示范围' }).selectOption('2026');
    const year = await read();
    assert(year.length === first.length && year[0].date === '2026-06-05', 'first year starts on June 5');
    await p.getByRole('tab', { name: '累计总量', exact: true }).click();
    const cumulative = await read();
    assert(cumulative.at(-1).tokens === first.filter(day => day.date <= '2026-12-31').reduce((sum, day) => sum + day.tokens, 0), 'lifetime cumulative totals');
    await p.getByRole('combobox', { name: '用量展示范围' }).selectOption('all');
    await p.getByRole('tab', { name: '每天', exact: true }).click();
    results.push('hover tooltip, year filter, June 5 start, cumulative view: passed');

    for (const [instant, today, cutoff] of [
      ['2026-11-15T16:00:00Z', '2026-11-16', '2026-11-15'],
      ['2026-11-30T16:00:00Z', '2026-12-01', '2026-11-30'],
      ['2026-12-31T16:00:00Z', '2027-01-01', '2026-12-31'],
    ]) {
      await p.evaluate(instant => { window.__demoNow = Date.parse(instant); window.dispatchEvent(new Event('focus')); }, instant);
      await p.waitForFunction(today => document.querySelector('[data-testid="codex-usage"]')?.dataset.today === today, today);
      const days = await read();
      assert(days.at(-1).date === cutoff && days.every(day => day.date < today), 'calendar refresh excludes incomplete dates');
      assert(days.find(day => day.date === '2026-11-14').tokens === first.at(-1).tokens, 'older values preserved');
    }
    results.push('Shanghai midnight, month and year rollover: passed');
    await p.getByRole('button', { name: '玩贪吃蛇 ↗', exact: true }).click();
    const snake = p.getByRole('group', { name: '网格贪吃蛇游戏', exact: true });
    await p.getByRole('button', { name: '开始游戏', exact: true }).click();
    assert(await snake.getAttribute('data-game-state') === 'running', 'snake starts');
    await p.getByRole('button', { name: '暂停', exact: true }).click();
    assert(await snake.getAttribute('data-game-state') === 'paused', 'snake pauses');
    await p.getByRole('button', { name: '← 返回用量', exact: true }).click();
    await panel.screenshot({ path: '.artifacts/demo-usage-desktop.png' });
    await p.setViewportSize({ width: 390, height: 844 });
    await panel.scrollIntoViewIfNeeded();
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile page does not overflow');
    await panel.screenshot({ path: '.artifacts/demo-usage-mobile.png' });
    assert(usageRequests.length === 0, `no real usage requests: ${usageRequests.join(', ')}`);
    assert(errors.length === 0, `no browser errors: ${errors.join(', ')}`);
    results.push('snake, desktop/mobile, zero real usage requests, zero page errors: passed');
    return results;
  } finally { await context.close(); }
}
