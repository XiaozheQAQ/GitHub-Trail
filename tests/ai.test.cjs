const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'github-trail.user.js'), 'utf8');
  source = source.replace(/  void init\(\)[\s\S]*?(?=  async function init\()/, '');
  source = source.replace(/\}\)\(\);\s*$/, `globalThis.api = {
    st, requestAiChat, limitAiMessages, normalizeAiSession, normalizeAiHistory,
    runAiAnalysisInitial, runAiFollowup, saveAiHistory, loadAiSession,
    renderAiConversation, normalizeSafeHref, renderInlineMarkdown
  };})();`);
  const requests = [];
  const context = vm.createContext({
    URL, console, setTimeout, clearTimeout,
    window: { location: { origin: 'https://github.com' } },
    GM_setValue: () => {},
    GM_xmlhttpRequest: (options) => {
      requests.push(options);
      options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: 'Analysis complete.' } }] }) });
    },
  });
  vm.runInContext(source, context);
  context.api.st.u.view = 'test';
  context.api.st.c.ai.apiKey = 'test-key';
  return { ...context.api, context, requests };
}

function conversation(turns) {
  return [
    { role: 'system', content: 'Use concise Chinese.' },
    { role: 'user', content: '[Repository History]\nrepo: owner/repo' },
    ...Array.from({ length: turns }, (_, index) => ({ role: index % 2 ? 'user' : 'assistant', content: `turn-${index}` })),
  ];
}

test('long AI conversations retain instructions, original history and latest question', async () => {
  const h = harness();
  await h.requestAiChat(conversation(60));
  const body = JSON.parse(h.requests[0].data);
  assert.equal(body.messages.length, 40);
  assert.equal(body.messages[0].role, 'system');
  assert.match(body.messages[1].content, /Repository History/);
  assert.equal(body.messages.at(-1).content, 'turn-59');
  assert.equal(h.requests[0].timeout, 90000);
  assert.equal(h.requests[0].headers.Authorization, 'Bearer test-key');
});

test('persisted long sessions keep recent turns instead of discarding them after reload', () => {
  const h = harness();
  const session = h.normalizeAiSession({ id: 'session', messages: conversation(250) }, 0);
  assert.equal(session.messages.length, 200);
  assert.equal(session.messages[0].role, 'system');
  assert.match(session.messages[1].content, /Repository History/);
  assert.equal(session.messages.at(-1).content, 'turn-249');
});

test('history deduplicates session IDs, keeping the latest version', () => {
  const h = harness();
  const history = h.normalizeAiHistory({ sessions: [
    { id: 'same', updatedAt: '2026-01-01T00:00:00Z', messages: [{ role: 'assistant', content: 'old' }] },
    { id: 'same', updatedAt: '2026-02-01T00:00:00Z', messages: [{ role: 'assistant', content: 'new' }] },
  ] });
  assert.equal(history.sessions.length, 1);
  assert.equal(history.sessions[0].messages[0].content, 'new');
});

test('missing configuration and empty history do not send requests', async () => {
  const h = harness();
  await h.runAiAnalysisInitial();
  assert.match(h.st.u.aiError, /先浏览/);
  assert.equal(h.requests.length, 0);
  h.st.c.ai.apiKey = '   ';
  await assert.rejects(h.requestAiChat(conversation(0)), /API/);
  assert.equal(h.requests.length, 0);
});

test('structured text responses work, invalid content produces a localized error', async () => {
  const h = harness();
  h.context.GM_xmlhttpRequest = (options) => options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'Useful result' }] } }] }) });
  assert.equal(await h.requestAiChat(conversation(0)), 'Useful result');
  h.context.GM_xmlhttpRequest = (options) => options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: { unexpected: true } } }] }) });
  await assert.rejects(h.requestAiChat(conversation(0)), /解析失败/);
  assert.match(h.st.u.aiIssue, /解析失败/);
});

test('AI HTTP errors are actionable and do not expose the provider response', async () => {
  const h = harness();
  h.context.GM_xmlhttpRequest = (options) => options.onload({ status: 401, responseText: 'sensitive provider details' });
  await assert.rejects(h.requestAiChat(conversation(0)), /鉴权失败/);
  assert.doesNotMatch(h.st.u.aiIssue, /sensitive/);
});

test('failed follow-up preserves draft and leaves the saved conversation unchanged', async () => {
  const h = harness();
  h.st.ah.sessions = [h.normalizeAiSession({ id: 'test', messages: conversation(1) }, 0)];
  h.st.u.activeAiSessionId = 'test';
  h.st.u.aiFollowupInput = { value: 'Please make a plan.' };
  h.context.GM_xmlhttpRequest = (options) => options.onerror();
  await h.runAiFollowup();
  assert.equal(h.st.u.aiDraft, 'Please make a plan.');
  assert.equal(h.st.ah.sessions[0].messages.length, 3);
  assert.equal(h.st.u.aiLoading, false);
  assert.ok(h.st.u.aiError);
});

test('loading another session is blocked during an active request', () => {
  const h = harness();
  h.st.ah.sessions = [h.normalizeAiSession({ id: 'another', messages: conversation(1) }, 0)];
  h.st.u.activeAiSessionId = 'original';
  h.st.u.aiLoading = true;
  assert.equal(h.loadAiSession('another'), false);
  assert.equal(h.st.u.activeAiSessionId, 'original');
});

test('storage failures keep the result in memory and report that it was not saved', async () => {
  const h = harness();
  h.st.ah.sessions = [h.normalizeAiSession({ id: 'test', messages: conversation(1) }, 0)];
  h.context.GM_setValue = () => { throw new Error('quota'); };
  assert.equal(await h.saveAiHistory(), false);
  assert.match(h.st.u.aiError, /保存失败/);
  assert.equal(h.st.ah.sessions[0].id, 'test');
});

test('initial activity payload is collapsed, escaped, and remains inspectable', () => {
  const h = harness();
  const html = h.renderAiConversation([{ role: 'user', content: '[Repository History]\n<script>alert(1)</script>' }]);
  assert.match(html, /<details class="gt-ai-context">/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('unsafe Markdown link protocols are rejected', () => {
  const h = harness();
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///test']) {
    assert.equal(h.normalizeSafeHref(url), '');
  }
  assert.equal(h.normalizeSafeHref('https://github.com/example/repo'), 'https://github.com/example/repo');
});

test('Markdown formatting does not rewrite link URLs or consume literal placeholder text', () => {
  const h = harness();
  const html = h.renderInlineMarkdown('[**Result**](https://example.com/*query*/value) `code` @@GT_INLINE_0@@');
  assert.match(html, /href="https:\/\/example.com\/\*query\*\/value"/);
  assert.match(html, /<strong>Result<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /@@GT_INLINE_0@@/);
});
