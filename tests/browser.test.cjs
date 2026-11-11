const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

// Uses a synthetic GitHub document and mocked userscript APIs. No account,
// credentials, GitHub traffic, AI provider, or WebDAV server is needed.
const script = fs.readFileSync(path.join(__dirname, '..', 'github-trail.user.js'), 'utf8');
const artifacts = path.join(__dirname, 'artifacts');
let browser;
before(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const candidates = [process.env.BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const executablePath = candidates.find(file => fs.existsSync(file));
  browser = await chromium.launch({ headless: true, downloadsPath: artifacts, ...(executablePath ? { executablePath } : {}) });
});
after(async () => browser?.close());

function seedData() {
  const now = Date.now();
  const repo = {};
  const names = ['GitHub-Trail', 'netease-music-winui', 'xiao zhe'.replace(' ', '-'),
    'KaleidoscopeCookery_Plugin', 'UotanToolboxNT', 'UotanToolBox', 'UniMC-Official',
    'lx-music-desktop', 'lx-music-netease-vip-source', 'A-very-long-repository-name-that-must-wrap-without-clipping',
    'archive-project', 'old-project'];
  names.forEach((name, i) => {
    const owner = i < 3 ? 'XiaozheQAQ' : 'Example';
    const key = `${owner}/${name}`.toLowerCase();
    repo[key] = { key, owner, repo: name, url: `https://github.com/${owner}/${name}`,
      visitCount: i === 1 ? 30 : i + 1, lastVisitedAt: new Date(now - i * 3 * 86400000).toISOString() };
  });
  return { version: 1, repo,
    user: { octocat: { key: 'octocat', username: 'octocat', url: 'https://github.com/octocat',
      visitCount: 4, lastVisitedAt: new Date(now - 86400000).toISOString() } },
    meta: { updatedAt: new Date(now).toISOString() } };
}

async function fixture(t, options = {}) {
  const theme = options.theme || 'dark';
  const context = await browser.newContext({ viewport: options.viewport || { width: 1440, height: 1000 },
    colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: options.reducedMotion || 'reduce', acceptDownloads: true });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <html data-color-mode="${theme}" data-dark-theme="dark" data-light-theme="light"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html { color-scheme:${theme}; --bgColor-default:${theme === 'dark' ? '#0d1117' : '#ffffff'};
      --bgColor-muted:${theme === 'dark' ? '#161b22' : '#f6f8fa'};
      --fgColor-default:${theme === 'dark' ? '#f0f6fc' : '#1f2328'};
      --fgColor-muted:${theme === 'dark' ? '#9198a1' : '#59636e'};
      --borderColor-default:${theme === 'dark' ? '#3d444d' : '#d1d9e0'}; }
    body { margin:0; background:var(--bgColor-default); color:var(--fgColor-default); font:14px Arial; }
    .Box-header { background:#eef2f7 !important; color:white !important; padding:30px !important; }
    button { font-size:40px !important; } input { border:8px solid magenta !important; }
    .Box { border:1px solid var(--borderColor-default); }
    </style></head><body><header style="padding:30px;border-bottom:1px solid #3d444d">GitHub · Test fixture</header>
    <main style="padding:40px"><a id="outside" href="#main">Outside focus target</a><h1>XiaozheQAQ / GitHub-Trail</h1>
    <p>Host styles are intentionally hostile to catch CSS leaks.</p></main></body></html>` }));
  await page.goto('https://github.com/explore');
  await page.evaluate(({ data, config }) => {
    window.__store = { 'github-trail:data': data, 'github-trail:config': config };
    window.__requests = [];
    window.__responses = [];
    window.GM_getValue = (key, fallback) => structuredClone(window.__store[key] ?? fallback);
    window.GM_setValue = (key, value) => { window.__store[key] = structuredClone(value); };
    window.GM_xmlhttpRequest = options => {
      window.__requests.push({ method: options.method, url: options.url, data: options.data, headers: options.headers });
      const response = window.__responses.shift() || { status: 200,
        responseText: JSON.stringify({ choices: [{ message: { content: '## 兴趣方向\n关注前端工具。\n\n**建议**：阅读项目文档。' } }] }) };
      const id = setTimeout(() => response.error ? options.onerror?.() : options.onload?.(response), 50);
      return { abort() { clearTimeout(id); options.onabort?.(); } };
    };
  }, { data: options.data || seedData(), config: options.config || { language: 'zh-CN', ui: { listMode: 'merged' } } });
  await page.addScriptTag({ content: script });
  await page.locator('#gt-topbar-button').waitFor();
  t.after(() => assert.deepEqual(errors, [], 'no uncaught browser errors'));
  return page;
}

async function open(page) {
  await page.locator('#gt-topbar-button').click();
  await page.locator('#gt-search').waitFor();
}
const rowLinks = page => page.locator('#gt-body a[href^="https://github.com/"]');

test('dark and light themes resist host CSS; keyboard close restores focus', async t => {
  for (const theme of ['dark', 'light']) {
    const page = await fixture(t, { theme });
    await open(page);
    const metrics = await page.evaluate(() => {
      const host = document.querySelector('#github-trail-root');
      const node = host.shadowRoot.querySelector('#gt-search');
      return { border: getComputedStyle(node).borderTopWidth, color: getComputedStyle(node).color, root: node.getRootNode().host?.id };
    });
    assert.equal(metrics.root, 'github-trail-root');
    assert.notEqual(metrics.border, '8px', 'host input border must not leak');
    const closeSize = await page.locator('#gt-close').evaluate(node => getComputedStyle(node).fontSize);
    assert.notEqual(closeSize, '40px', 'host button font must not leak');
    await page.screenshot({ path: path.join(artifacts, `history-${theme}.png`), fullPage: true });
    await page.locator('#gt-sidebar').screenshot({ path: path.join(artifacts, `history-${theme}-panel.png`) });
    await page.keyboard.press('Escape');
    const focus = await page.evaluate(() => ({ document: document.activeElement?.id,
      shadow: document.querySelector('#github-trail-root').shadowRoot.activeElement?.id,
      hidden: document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-sidebar').hidden }));
    assert.equal(focus.shadow, 'gt-topbar-button', JSON.stringify(focus));
    assert.equal(await page.locator('#gt-search').isVisible(), false);
  }
});

test('search, category, period, sorting and split/merged views show actual matching records', async t => {
  const page = await fixture(t);
  await open(page);
  await page.locator('#gt-search').pressSequentially('netease');
  assert.equal(await page.locator('#gt-search').inputValue(), 'netease', 'rerender must preserve typing focus');
  assert.equal(await rowLinks(page).count(), 2);
  await page.locator('#gt-search').fill('NO-MATCH-RECORD');
  assert.equal(await rowLinks(page).count(), 0);
  await page.locator('#gt-search').fill('');
  await page.locator('#gt-type').selectOption('user');
  assert.equal(await rowLinks(page).count(), 1);
  assert.match(await rowLinks(page).first().innerText(), /octocat/);
  await page.locator('#gt-type').selectOption('repo');
  await page.locator('#gt-sort').selectOption('visits');
  assert.match(await rowLinks(page).first().innerText(), /netease-music-winui/);
  await page.locator('#gt-period').selectOption('week');
  assert.equal(await rowLinks(page).count(), 3);
  await page.locator('#gt-period').selectOption('all');
  await page.locator('#gt-type').selectOption('all');
  await page.locator('#gt-ms').click();
  assert.equal(await page.locator('#gt-ms').getAttribute('aria-pressed'), 'true');
  await page.locator('#gt-mm').click();
  assert.equal(await page.locator('#gt-mm').getAttribute('aria-pressed'), 'true');
});

test('delete one record and undo persist without deleting other records', async t => {
  const page = await fixture(t);
  await open(page);
  await page.locator('#gt-search').fill('GitHub-Trail');
  assert.equal(await rowLinks(page).count(), 1);
  await page.locator('[data-delete]').first().click();
  assert.equal(await rowLinks(page).count(), 0);
  assert.equal(await page.evaluate(() => Object.keys(window.__store['github-trail:data'].repo).length), 11);
  await page.locator('#gt-undo').click();
  assert.equal(await rowLinks(page).count(), 1);
  assert.equal(await page.evaluate(() => Object.keys(window.__store['github-trail:data'].repo).length), 12);
});

test('mobile panel fits viewport with long repository names and settings', async t => {
  const page = await fixture(t, { viewport: { width: 360, height: 740 } });
  await open(page);
  await page.locator('#gt-search').fill('very-long');
  const bounds = await page.locator('#gt-body').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth,
    right: node.getBoundingClientRect().right, viewport: innerWidth }));
  assert.ok(bounds.scroll <= bounds.width + 1, JSON.stringify(bounds));
  assert.ok(bounds.right <= bounds.viewport + 1, JSON.stringify(bounds));
  await page.screenshot({ path: path.join(artifacts, 'history-mobile.png'), fullPage: true });
  await page.locator('#gt-toggle').click();
  await page.locator('#gt-save').waitFor();
  const settings = await page.locator('#gt-body').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  assert.ok(settings.scroll <= settings.width + 1, JSON.stringify(settings));
  await page.screenshot({ path: path.join(artifacts, 'settings-mobile.png'), fullPage: true });
});

test('settings validation keeps saved state; language changes and survives reopen', async t => {
  const page = await fixture(t);
  await open(page);
  await page.locator('#gt-toggle').click();
  await page.locator('#gt-lang').selectOption('en');
  await page.locator('#gt-ai-config > summary').click();
  await page.locator('#gt-ai-url').fill('javascript:alert(1)');
  await page.locator('#gt-ai-config > summary').click();
  await page.locator('#gt-save').click();
  assert.equal(await page.evaluate(() => window.__store['github-trail:config'].language), 'zh-CN');
  await page.locator('#gt-status.error').waitFor();
  assert.match(await page.locator('#gt-status').innerText(), /https/i);
  await page.locator('#gt-ai-config > summary').click();
  await page.locator('#gt-ai-url').fill('https://example.com/v1/chat/completions');
  await page.locator('#gt-save').click();
  assert.equal(await page.evaluate(() => window.__store['github-trail:config'].language), 'en');
  await page.locator('#gt-toggle').click();
  await page.locator('#gt-close').click();
  await open(page);
  assert.match(await page.locator('#gt-title').innerText(), /History/i);
});

test('JSON import merges records and rejects malformed structure; export payload is reusable', async t => {
  const page = await fixture(t);
  await open(page);
  const imported = { version: 1, repo: { 'imported/repo': { owner: 'Imported', repo: 'Repo',
    url: 'https://github.com/Imported/Repo', visitCount: 3, lastVisitedAt: new Date().toISOString() } }, user: {} };
  await page.locator('#gt-import-file').setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.waitForFunction(() => !!window.__store['github-trail:data'].repo['imported/repo']);
  await page.locator('#gt-import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"notHistory":true}') });
  await page.waitForFunction(() => document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-status')?.classList.contains('error'));
  assert.equal(await page.evaluate(() => Object.keys(window.__store['github-trail:data'].repo).length), 13);
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      window.__exportPayload = blob.text();
      return create(blob);
    };
  });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#gt-export').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^github-history-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await page.evaluate(() => window.__exportPayload));
  assert.equal(Object.keys(exported.repo).length, 13);
  assert.equal(exported.repo['imported/repo'].visitCount, 3);
  t.diagnostic('Verified the actual export Blob and download filename. OS/browser download completion is outside this mocked integration test.');
});

test('AI request is explicit, results render safely, and follow-up survives errors', async t => {
  const page = await fixture(t, { config: { language: 'zh-CN',
    ai: { apiUrl: 'https://example.com/v1/chat/completions', apiKey: 'test-only', model: 'test-model' } } });
  await open(page);
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
  await page.locator('#gt-ai').click();
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
  await page.locator('#gt-ai-run').click();
  await page.locator('.gt-chat-content').first().waitFor();
  assert.equal(await page.evaluate(() => window.__requests.length), 1);
  await page.locator('#gt-ai-followup').fill('给我一个学习计划');
  await page.evaluate(() => window.__responses.push({ error: true }));
  await page.locator('#gt-ai-send').click();
  await page.waitForFunction(() => document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-ai-send')?.disabled === false);
  assert.equal(await page.locator('#gt-ai-followup').inputValue(), '给我一个学习计划');
  await page.locator('#gt-ai-send').click();
  await page.waitForFunction(() => window.__store['github-trail:ai-history']?.sessions[0]?.messages.length >= 4);
  assert.ok(await page.locator('.gt-chat-content').count() >= 3);
  await page.screenshot({ path: path.join(artifacts, 'analysis-dark.png'), fullPage: true });
  await page.locator('#gt-sidebar').screenshot({ path: path.join(artifacts, 'analysis-dark-panel.png') });
});

test('empty history does not send an AI request', async t => {
  const page = await fixture(t, { data: { version: 1, repo: {}, user: {} }, config: { language: 'zh-CN',
    ai: { apiUrl: 'https://example.com/v1/chat/completions', apiKey: 'test-only', model: 'test-model' } } });
  await open(page);
  await page.locator('#gt-ai').click();
  await page.locator('#gt-ai-run').click();
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
});

test('GitHub soft navigation records repository subpages only once per navigation', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    history.pushState({}, '', '/Example/deep-repo/issues/42');
    document.dispatchEvent(new Event('turbo:render'));
  });
  await page.waitForFunction(() => window.__store['github-trail:data'].repo['example/deep-repo']?.visitCount === 1);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('turbo:render'));
    document.dispatchEvent(new Event('pjax:end'));
  });
  assert.equal(await page.evaluate(() => window.__store['github-trail:data'].repo['example/deep-repo'].visitCount), 1);
  await open(page);
  await page.locator('#gt-search').fill('deep-repo');
  assert.equal(await rowLinks(page).count(), 1);
});

test('IME composition keeps the active search input until text is committed', async t => {
  const page = await fixture(t);
  await open(page);
  const result = await page.locator('#gt-search').evaluate(input => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    input.value = '网易';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '网易', isComposing: true }));
    const connectedDuringComposition = input.isConnected;
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '网易' }));
    return connectedDuringComposition;
  });
  assert.equal(result, true, 'the composing element must not be replaced');
  assert.equal(await page.locator('#gt-search').inputValue(), '网易');
  assert.equal(await rowLinks(page).count(), 0);
});

test('panel typing does not trigger host page single-key shortcuts', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    window.__hostShortcutCount = 0;
    document.addEventListener('keydown', event => {
      if (event.key === 't' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) window.__hostShortcutCount++;
    });
  });
  await open(page);
  await page.locator('#gt-search').pressSequentially('trail');
  assert.equal(await page.evaluate(() => window.__hostShortcutCount), 0);
});

test('manual WebDAV sync restores edit controls after GET and PUT complete', async t => {
  const page = await fixture(t, { config: { language: 'zh-CN',
    webdav: { enabled: true, baseUrl: 'https://dav.example.com/trail/', username: 'test', password: 'test-only' } } });
  await open(page);
  await page.evaluate(() => window.__responses.push(
    { status: 200, responseText: JSON.stringify(window.__store['github-trail:data']), responseHeaders: 'ETag: "test-version"\r\n' },
    { status: 204, responseText: '' }));
  await page.locator('#gt-sync').click();
  await page.waitForFunction(() => window.__requests.length === 2 &&
    document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-sync')?.disabled === false);
  assert.deepEqual(await page.evaluate(() => window.__requests.map(request => request.method)), ['GET', 'PUT']);
  assert.equal(await page.locator('[data-delete]:disabled, [data-pin]:disabled').count(), 0);
  await page.locator('#gt-toggle').click();
  assert.equal(await page.locator('#gt-clear-settings').isEnabled(), true);
});

test('large histories load more and favorites persist through filter changes', async t => {
  const data = seedData();
  for (let i = 0; i < 20; i++) {
    const key = `more/repo-${i}`;
    data.repo[key] = { key, owner: 'More', repo: `repo-${i}`, url: `https://github.com/${key}`,
      visitCount: 1, lastVisitedAt: new Date(Date.now() - (40 + i) * 86400000).toISOString() };
  }
  const page = await fixture(t, { data });
  await open(page);
  assert.equal(await rowLinks(page).count(), 30);
  await page.locator('#gt-va').click();
  assert.equal(await rowLinks(page).count(), 33);
  assert.equal(await page.locator('#gt-va').count(), 0);
  await page.locator('#gt-search').fill('GitHub-Trail');
  await page.locator('[data-pin]').click();
  await page.waitForFunction(() => window.__store['github-trail:data'].repo['xiaozheqaq/github-trail'].pinned === true);
  await page.locator('#gt-search').fill('');
  await page.locator('#gt-pinned').click();
  assert.equal(await rowLinks(page).count(), 1);
  await page.locator('[data-pin]').click();
  await page.waitForFunction(() => window.__store['github-trail:data'].repo['xiaozheqaq/github-trail'].pinned === false);
  assert.equal(await rowLinks(page).count(), 0);
});

async function finishPanelMotion(page) {
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    const root = document.querySelector('#github-trail-root').shadowRoot;
    const animations = [...root.querySelector('#gt-sidebar').getAnimations({ subtree: true }),
      ...root.querySelector('.gt-backdrop').getAnimations()];
    await Promise.allSettled(animations.map(animation => animation.finished));
  });
}

test('closing animates before hiding, then restores focus, scrolling and host interaction', async t => {
  const page = await fixture(t, { reducedMotion: 'no-preference' });
  await page.evaluate(() => { document.body.style.overflow = 'scroll'; document.querySelector('#outside').focus(); });
  await page.keyboard.press('Alt+Shift+H');
  await page.locator('#gt-search').waitFor();
  await finishPanelMotion(page);
  const immediate = await page.evaluate(() => {
    const root = document.querySelector('#github-trail-root').shadowRoot;
    root.querySelector('#gt-close').click();
    return { hidden: root.querySelector('#gt-sidebar').hidden, overflow: document.body.style.overflow,
      outsideInert: document.querySelector('main').inert };
  });
  assert.equal(immediate.hidden, false, 'close must leave the panel visible for its exit animation');
  assert.equal(immediate.overflow, 'hidden', 'scroll remains locked during exit');
  assert.equal(immediate.outsideInert, true, 'host remains inert during exit');
  await page.waitForFunction(() => document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-sidebar').hidden);
  const finished = await page.evaluate(() => ({ focus: document.activeElement.id,
    overflow: document.body.style.overflow, outsideInert: document.querySelector('main').inert,
    backdropHidden: document.querySelector('#github-trail-root').shadowRoot.querySelector('.gt-backdrop').hidden }));
  assert.deepEqual(finished, { focus: 'outside', overflow: 'scroll', outsideInert: false, backdropHidden: true });
});

test('reopening during exit cannot be hidden by an old close callback', async t => {
  const page = await fixture(t, { reducedMotion: 'no-preference' });
  await open(page);
  const immediate = await page.evaluate(() => {
    const root = document.querySelector('#github-trail-root').shadowRoot;
    root.querySelector('#gt-close').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'H', altKey: true, shiftKey: true, bubbles: true }));
    return { hidden: root.querySelector('#gt-sidebar').hidden,
      expanded: root.querySelector('#gt-topbar-button').getAttribute('aria-expanded') };
  });
  assert.deepEqual(immediate, { hidden: false, expanded: 'true' });
  // Exercise the delayed cleanup window from the superseded close operation.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 700)));
  const finished = await page.evaluate(() => {
    const root = document.querySelector('#github-trail-root').shadowRoot;
    return { hidden: root.querySelector('#gt-sidebar').hidden, backdropHidden: root.querySelector('.gt-backdrop').hidden,
      overflow: document.body.style.overflow, outsideInert: document.querySelector('main').inert };
  });
  assert.deepEqual(finished, { hidden: false, backdropHidden: false, overflow: 'hidden', outsideInert: true });
  await page.locator('#gt-search').fill('trail');
  assert.equal(await rowLinks(page).count(), 1, 'reopened panel remains interactive');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-sidebar').hidden);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
});

test('reduced motion closes synchronously without remaining animations or scroll locks', async t => {
  const page = await fixture(t, { reducedMotion: 'reduce' });
  await open(page);
  const result = await page.evaluate(() => {
    const root = document.querySelector('#github-trail-root').shadowRoot;
    root.querySelector('#gt-close').click();
    const running = [...root.querySelector('#gt-sidebar').getAnimations({ subtree: true }),
      ...root.querySelector('.gt-backdrop').getAnimations()].filter(animation => animation.playState === 'running');
    return { hidden: root.querySelector('#gt-sidebar').hidden, running: running.length,
      overflow: document.body.style.overflow, outsideInert: document.querySelector('main').inert,
      focus: root.activeElement?.id };
  });
  assert.deepEqual(result, { hidden: true, running: 0, overflow: '', outsideInert: false, focus: 'gt-topbar-button' });
});

test('hover feedback changes button and record appearance with a motion transition', async t => {
  const page = await fixture(t, { reducedMotion: 'no-preference' });
  await open(page);
  await finishPanelMotion(page);
  for (const selector of ['#gt-close', '.gt-record', '.gt-record [data-delete]']) {
    const node = page.locator(selector).first();
    await page.mouse.move(100, 100);
    await finishPanelMotion(page);
    await node.evaluate(async element => {
      getComputedStyle(element).backgroundColor;
      await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    });
    const before = await node.evaluate(element => {
      const css = getComputedStyle(element);
      return { background: css.backgroundColor, color: css.color };
    });
    if (selector === '.gt-record') await page.locator('#gt-sidebar').screenshot({ path: path.join(artifacts, 'motion-hover-before.png') });
    await node.hover();
    await node.evaluate(async element => {
      getComputedStyle(element).backgroundColor;
      await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    });
    const after = await node.evaluate(element => {
      const css = getComputedStyle(element);
      return { background: css.backgroundColor, color: css.color, durations: css.transitionDuration };
    });
    assert.notDeepEqual({ background: after.background, color: after.color }, before, `${selector} should visibly respond to hover`);
    assert.ok(after.durations.split(',').some(duration => parseFloat(duration) > 0), `${selector} should interpolate hover styles`);
    if (selector === '.gt-record') await page.locator('#gt-sidebar').screenshot({ path: path.join(artifacts, 'motion-hover-after.png') });
  }
});

test('switching to reduced motion during exit finishes cleanup without a stale lock', async t => {
  const page = await fixture(t, { reducedMotion: 'no-preference' });
  await open(page);
  await finishPanelMotion(page);
  assert.equal(await page.locator('#gt-close').evaluate(button => {
    button.click();
    return button.closest('#gt-sidebar').hidden;
  }), false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#github-trail-root').shadowRoot.querySelector('#gt-sidebar').hidden);
  const result = await page.evaluate(() => {
    const root = document.querySelector('#github-trail-root').shadowRoot;
    return { overflow: document.body.style.overflow, outsideInert: document.querySelector('main').inert,
      backdropHidden: root.querySelector('.gt-backdrop').hidden,
      animations: root.querySelector('#gt-sidebar').getAnimations().filter(animation => animation.playState === 'running').length };
  });
  assert.deepEqual(result, { overflow: '', outsideInert: false, backdropHidden: true, animations: 0 });
});

test('holding the keyboard shortcut does not repeatedly open and close the panel', async t => {
  const page = await fixture(t);
  const result = await page.evaluate(() => {
    const root = document.querySelector('#github-trail-root').shadowRoot;
    const shortcut = repeat => new KeyboardEvent('keydown', { key: 'H', code: 'KeyH', altKey: true, shiftKey: true, repeat, bubbles: true });
    document.dispatchEvent(shortcut(false));
    for (let i = 0; i < 5; i++) {
      document.dispatchEvent(shortcut(true));
      root.querySelector('#gt-search').dispatchEvent(shortcut(true));
    }
    const stayedOpen = !root.querySelector('#gt-sidebar').hidden;
    root.querySelector('#gt-search').dispatchEvent(shortcut(false));
    return { stayedOpen, closedOnce: root.querySelector('#gt-sidebar').hidden, overflow: document.body.style.overflow };
  });
  assert.deepEqual(result, { stayedOpen: true, closedOnce: true, overflow: '' });
});
