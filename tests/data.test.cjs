const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'github-trail.user.js'), 'utf8');
function load(overrides = {}) {
  const writes = [];
  const storage = new Map();
  const context = vm.createContext({
    URL, Blob, Date, console, setTimeout, clearTimeout,
    window: { location: { hostname: 'github.com', pathname: '/Octo/Hello' } },
    GM_getValue: (key, fallback) => structuredClone(storage.has(key) ? storage.get(key) : fallback),
    GM_setValue: (key, value) => { writes.push({ key, value }); storage.set(key, structuredClone(value)); },
    GM_xmlhttpRequest: () => { throw new Error('Unexpected network request'); },
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    ...overrides,
  });
  const instrumented = source.replace(/  void init\(\)[\s\S]*?(?=  async function init\()/, '').replace(/\}\)\(\);\s*$/, `
    globalThis.api = { st, parseRoute, record, normData, normCfg, merge, validateHistory,
      buildUrl, syncWebDav, getV, setV, defData, req, importHistory, clearAll, mutateData, watchData };
  })();`);
  vm.runInContext(instrumented, context);
  return { ...context.api, context, writes, storage };
}
function history(items = {}) {
  return { version: 1, repo: items, user: {}, meta: { updatedAt: '' } };
}
function repo(fields = {}) {
  return { owner: 'Octo', repo: 'Hello', lastVisitedAt: '2026-11-01T00:00:00Z', visitCount: 2, ...fields };
}

test('repository subroutes are recorded under one canonical repository', () => {
  const api = load();
  for (const suffix of ['', '/issues/42', '/pull/7', '/tree/main/src', '/wiki']) {
    const result = api.parseRoute(`/Octo/Hello${suffix}`);
    assert.equal(result.type, 'repo');
    assert.equal(result.key, 'octo/hello');
    assert.equal(result.url, 'https://github.com/Octo/Hello');
  }
});

test('non-profile GitHub routes and invalid path identities are excluded', () => {
  const api = load();
  for (const pathname of ['/', '/settings/profile', '/search/code', '/orgs/acme/teams', '/__proto__', '/foo/..', '/foo/<script>']) {
    assert.equal(api.parseRoute(pathname), null, pathname);
  }
  assert.equal(api.parseRoute('/Octo/').key, 'octo');
});

test('repeated render events do not inflate visits, but returning later does', async () => {
  const api = load();
  await api.record();
  api.st.last.t = 0; // Simulate an arbitrarily late repeated turbo:render.
  await api.record();
  assert.equal(api.st.d.repo['octo/hello'].visitCount, 1);
  api.context.window.location.pathname = '/settings';
  await api.record();
  api.context.window.location.pathname = '/Octo/Hello';
  await api.record();
  assert.equal(api.st.d.repo['octo/hello'].visitCount, 2);
});

test('paused tracking makes no writes; navigating preserves pinned records', async () => {
  const api = load();
  api.st.c.recordingPaused = true;
  await api.record();
  assert.equal(api.writes.length, 0);
  api.st.c.recordingPaused = false;
  api.st.d = api.normData(history({ 'octo/hello': repo({ pinned: true }) }));
  api.storage.set('github-trail:data', structuredClone(api.st.d));
  api.context.window.location.pathname = '/Octo/Hello/issues/1';
  await api.record();
  assert.equal(api.st.d.repo['octo/hello'].pinned, true);
  assert.equal(api.st.d.repo['octo/hello'].visitCount, 3);
});

test('import normalization reconstructs safe links and deduplicates case variants', () => {
  const api = load();
  const data = api.validateHistory(history({
    'Octo/Hello': repo({ url: 'javascript:alert(1)', visitCount: 4 }),
    'octo/hello': repo({ owner: 'octo', repo: 'hello', visitCount: 8, lastVisitedAt: '2026-11-02' }),
  }));
  assert.equal(Object.keys(data.repo).length, 1);
  assert.equal(data.repo['octo/hello'].visitCount, 8);
  assert.equal(data.repo['octo/hello'].url, 'https://github.com/octo/hello');
});

test('bad schemas, future versions, and invalid records fail import validation', () => {
  const api = load();
  for (const data of [null, [], {}, { repo: [] }, { repo: null }, { version: 99, repo: {} }, { user: { '<script>': {} } }, { repo: { 'octo/hello': 42 } }]) {
    assert.throws(() => api.validateHistory(data));
  }
  assert.equal(Object.keys(api.validateHistory({ repo: {}, user: {} }).repo).length, 0);
});

test('prototype keys, non-finite counts, and invalid timestamps cannot poison storage', () => {
  const api = load();
  const data = api.normData(JSON.parse('{"user":{"__proto__":{"username":"__proto__"},"constructor":{"username":"constructor"},"Octo":{"visitCount":"NaN","lastVisitedAt":"bad"}},"repo":{}}'));
  assert.equal(Object.keys(data.user).length, 2);
  assert.equal(data.user.constructor.username, 'constructor');
  assert.equal(data.user.constructor.visitCount, 1);
  assert.equal(data.user.octo.visitCount, 1);
  assert.equal(data.user.octo.lastVisitedAt, '');
  assert.equal(Object.prototype.polluted, undefined);
});

test('constructor is a valid username and never reads an inherited map entry', async () => {
  const api = load();
  const imported = api.validateHistory({ user: { constructor: { username: 'constructor', visitCount: 3 } } });
  assert.equal(imported.user.constructor.visitCount, 3);
  assert.equal(imported.user.constructor.url, 'https://github.com/constructor');
  api.context.window.location.pathname = '/constructor';
  await api.record();
  assert.equal(api.st.d.user.constructor.visitCount, 1);
  api.context.window.location.pathname = '/Octo/Hello';
  await api.record();
  api.context.window.location.pathname = '/constructor';
  await api.record();
  assert.equal(api.st.d.user.constructor.visitCount, 2);
});

test('merging the same export twice keeps visit counts stable', () => {
  const api = load();
  const a = history({ 'octo/hello': repo({ visitCount: 10 }) });
  const b = history({ 'octo/hello': repo({ visitCount: 12, lastVisitedAt: '2026-11-02' }) });
  const once = api.merge(a, b);
  const twice = api.merge(once, b);
  assert.equal(once.repo['octo/hello'].visitCount, 12);
  assert.equal(twice.repo['octo/hello'].visitCount, 12);
  assert.equal(twice.repo['octo/hello'].lastVisitedAt, '2026-11-02T00:00:00.000Z');
});

test('normalization retains the newest 500 records', () => {
  const api = load();
  const records = {};
  for (let i = 0; i < 520; i++) records[`octo/repo${i}`] = repo({ repo: `repo${i}`, lastVisitedAt: new Date(1700000000000 + i * 1000).toISOString() });
  const data = api.normData(history(records));
  assert.equal(Object.keys(data.repo).length, 500);
  assert.equal(data.repo['octo/repo0'], undefined);
  assert.ok(data.repo['octo/repo519']);
});

test('config defaults to merged history, clamps limits, and preserves new preferences', () => {
  const api = load();
  assert.equal(api.normCfg({}).ui.listMode, 'merged');
  const cfg = api.normCfg({ maxItemsPerType: -1, recordingPaused: true, ui: { theme: 'dark', listMode: 'split' } });
  assert.equal(cfg.maxItemsPerType, 1);
  assert.equal(cfg.recordingPaused, true);
  assert.equal(cfg.ui.theme, 'dark');
  assert.equal(cfg.ui.listMode, 'split');
});

test('WebDAV addresses require HTTPS and append only the data file', () => {
  const api = load();
  assert.equal(api.buildUrl('https://dav.example/folder/'), 'https://dav.example/folder/github-history.json');
  assert.equal(api.buildUrl('https://dav.example/folder/github-history.json'), 'https://dav.example/folder/github-history.json');
  for (const url of ['http://dav.example/', 'https://user:pass@dav.example/', 'https://dav.example/?token=x', 'javascript:alert(1)', 'https://dav.example/#folder']) {
    assert.throws(() => api.buildUrl(url));
  }
});

test('storage failures propagate instead of reporting false success', async () => {
  const api = load({ GM_setValue: () => Promise.reject(new Error('quota')) });
  await assert.rejects(api.setV('key', {}), /本地保存失败/);
  assert.match(api.st.u.status, /本地保存失败/);
});

test('failed reads block later writes to protect existing stored data', async () => {
  const api = load({ GM_getValue: () => { throw new Error('denied'); } });
  await assert.rejects(api.getV('key', {}), /Cannot read/);
  await assert.rejects(api.setV('key', {}), /停止写入/);
  assert.equal(api.writes.length, 0);
});

test('failed import and clear preserve the in-memory records', async () => {
  const api = load({ GM_setValue: () => Promise.reject(new Error('quota')) });
  api.st.d = history({ 'octo/hello': repo() });
  const original = api.st.d;
  api.st.u.importInput = { files: [{ size: 200, text: async () => JSON.stringify(history({ 'octo/another': repo({ repo: 'another' }) })) }], value: 'backup.json' };
  await api.importHistory();
  assert.equal(api.st.d, original);
  assert.match(api.st.u.status, /导入失败/);
  assert.equal(api.st.u.importInput.value, '');
  api.context.window.confirm = () => true;
  await assert.rejects(api.clearAll(), /本地保存失败/);
  assert.equal(api.st.d, original);
});

test('queued storage writes capture snapshots and preserve order', async () => {
  const writes = [];
  let release;
  const api = load({ GM_setValue: async (_key, value) => {
    if (!writes.length) { writes.push(value); await new Promise(resolve => { release = resolve; }); }
    else writes.push(value);
  } });
  const data = { n: 1 };
  const first = api.setV('key', data);
  data.n = 2;
  const second = api.setV('key', data);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[0].n, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(writes[1].n, 2);
});

test('sync validates remote data before PUT and preserves visits arriving during GET', async () => {
  const requests = [];
  let api;
  api = load({ GM_xmlhttpRequest: request => {
    requests.push(request);
    if (request.method === 'GET') {
      api.st.d = history({ 'octo/hello': repo({ visitCount: 7 }) });
      request.onload({ status: 200, responseText: JSON.stringify(history()), responseHeaders: 'ETag: "revision-1"\r\n' });
    } else request.onload({ status: 204 });
  } });
  const result = await api.syncWebDav(() => api.st.d, { baseUrl: 'https://dav.example/' });
  assert.equal(result.repo['octo/hello'].visitCount, 7);
  assert.equal(requests[1].headers['If-Match'], '"revision-1"');
  assert.equal(requests[0].timeout, 60000);
  assert.equal(requests[0].anonymous, true);
});

test('malformed remote data never triggers destructive PUT', async () => {
  const requests = [];
  const api = load({ GM_xmlhttpRequest: request => {
    requests.push(request);
    request.onload({ status: 200, responseText: '{"unexpected":true}' });
  } });
  await assert.rejects(api.syncWebDav(history(), { baseUrl: 'https://dav.example/' }));
  assert.equal(requests.length, 1);
});

test('remote creation uses a conditional PUT and reports edit conflicts', async () => {
  let put;
  const api = load({ GM_xmlhttpRequest: request => {
    if (request.method === 'GET') request.onload({ status: 404 });
    else { put = request; request.onload({ status: 412 }); }
  } });
  await assert.rejects(api.syncWebDav(history(), { baseUrl: 'https://dav.example/' }), /其他设备更新/);
  assert.equal(put.headers['If-None-Match'], '*');
});

function sharedTabs() {
  const data = new Map();
  const locks = new Map();
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const options = {
    navigator: { locks: { request(name, callback) {
      const current = (locks.get(name) || Promise.resolve()).catch(() => {}).then(callback);
      locks.set(name, current.catch(() => {}));
      return current;
    } } },
    GM_getValue: async (key, fallback) => { await tick(); return structuredClone(data.has(key) ? data.get(key) : fallback); },
    GM_setValue: async (key, value) => { await tick(); data.set(key, structuredClone(value)); },
  };
  return { data, first: load(options), second: load(options) };
}

test('two tabs visiting different repositories simultaneously retain both records', async () => {
  const { data, first, second } = sharedTabs();
  first.context.window.location.pathname = '/Octo/First';
  second.context.window.location.pathname = '/Octo/Second';
  await Promise.all([first.record(), second.record()]);
  const saved = data.get('github-trail:data');
  assert.equal(Object.keys(saved.repo).length, 2);
  assert.equal(saved.repo['octo/first'].visitCount, 1);
  assert.equal(saved.repo['octo/second'].visitCount, 1);
});

test('simultaneous visits to the same repository increment instead of overwrite', async () => {
  const { data, first, second } = sharedTabs();
  await Promise.all([first.record(), second.record()]);
  assert.equal(data.get('github-trail:data').repo['octo/hello'].visitCount, 2);
});

test('a stale tab editing a record cannot resurrect another tab deletion', async () => {
  const { data, first, second } = sharedTabs();
  const original = history({ 'octo/hello': repo(), 'octo/other': repo({ repo: 'other' }) });
  data.set('github-trail:data', structuredClone(original));
  second.st.d = structuredClone(original);
  await first.mutateData(draft => { delete draft.repo['octo/hello']; });
  await second.mutateData(draft => { draft.repo['octo/other'].pinned = true; });
  const saved = data.get('github-trail:data');
  assert.equal(saved.repo['octo/hello'], undefined);
  assert.equal(saved.repo['octo/other'].pinned, true);
});

test('fallback queue serializes same-tab edits when Web Locks is unavailable', async () => {
  let stored = history({ 'octo/hello': repo() });
  const api = load({
    GM_getValue: async () => { await new Promise(resolve => setImmediate(resolve)); return structuredClone(stored); },
    GM_setValue: async (_key, value) => { await new Promise(resolve => setImmediate(resolve)); stored = structuredClone(value); },
  });
  await Promise.all(Array.from({ length: 20 }, () => api.mutateData(draft => { draft.repo['octo/hello'].visitCount++; })));
  assert.equal(stored.repo['octo/hello'].visitCount, 22);
  assert.equal(api.st.d.repo['octo/hello'].visitCount, 22);
});

test('a failed atomic mutation leaves the stored and visible data untouched', async () => {
  const original = history({ 'octo/hello': repo() });
  const api = load({ GM_getValue: () => structuredClone(original), GM_setValue: () => { throw new Error('quota'); } });
  api.st.d = structuredClone(original);
  await assert.rejects(api.mutateData(draft => { delete draft.repo['octo/hello']; }), /本地保存失败/);
  assert.equal(api.st.d.repo['octo/hello'].visitCount, 2);
  assert.equal(original.repo['octo/hello'].visitCount, 2);
});

test('optional remote-storage listener updates cached history without repainting fields', () => {
  let listener;
  let registrations = 0;
  const api = load({ GM_addValueChangeListener: (key, callback) => {
    assert.equal(key, 'github-trail:data');
    listener = callback;
    registrations++;
    return 1;
  } });
  api.watchData();
  api.watchData();
  listener('github-trail:data', null, history({ 'octo/hello': repo() }), true);
  assert.equal(api.st.d.repo['octo/hello'].visitCount, 2);
  assert.equal(registrations, 1);
});
