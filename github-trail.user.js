// ==UserScript==
// @name         GitHub Trail
// @namespace    https://github.com/
// @version      1.2.1
// @description  Record visited GitHub repositories and user profiles with local JSON + optional WebDAV sync.
// @author       GitHub Trail
// @license      AGPL-3.0-only
// @homepageURL  https://github.com/XiaozheQAQ/GitHub-Trail
// @supportURL   https://github.com/XiaozheQAQ/GitHub-Trail/issues
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      *
// @icon         https://pic.clami.fun/file/AgACAgUAAyEGAATfaZ8ZAAMDaazl6YjrLJDZejQQV0bUsffuyYgAAqkNaxuO4GhVK0MrNze09S0BAAMCAAN5AAM6BA.png
// @noframes
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  const DATA_KEY = "github-trail:data";
  const CFG_KEY = "github-trail:config";
  const AI_HISTORY_KEY = "github-trail:ai-history";
  const MAX = 500;
  const AI_HISTORY_MAX_SESSIONS = 20;
  const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
  const FILE = "github-history.json";
  const LOGO_DATA_URL = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%231f883d'/%3E%3Cstop offset='100%25' stop-color='%230ea5e9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' rx='28' fill='%23ffffff'/%3E%3Ccircle cx='80' cy='80' r='58' fill='url(%23g)'/%3E%3Ctext x='80' y='95' text-anchor='middle' fill='%23ffffff' font-family='Segoe UI,Arial,sans-serif' font-size='56' font-weight='700'%3EGT%3C/text%3E%3C/svg%3E";
  const EX = ["/settings", "/features", "/marketplace", "/actions"];
  const RESERVED = new Set([
    "about", "account", "actions", "apps", "blog", "codespaces", "collections", "contact", "copilot", "customer-stories", "dashboard", "discussions", "enterprise",
    "events", "explore", "features", "gist", "gists", "issues", "join", "login", "logout", "marketplace",
    "new", "notifications", "orgs", "organizations", "pricing", "pulls", "search", "security", "session",
    "readme", "resources", "settings", "signup", "site", "solutions", "sponsors", "team", "teams", "topics", "trending", "users"
  ]);

  const I18N = {
    "zh-CN": {
      title: "GitHub Trail", ph: "历史记录", ps: "设置", bs: "打开设置", bb: "返回历史", bc: "关闭", ba: "关于",
      ms: "分类显示", mm: "合并显示", sr: "仓库", su: "用户", sm: "合并历史",
      va: "查看全部历史", vl: "收起列表", nr: "暂无仓库记录", nu: "暂无用户记录", nh: "暂无历史记录",
      sn: "立即同步", ca: "清空全部历史", cc: "确认清空所有仓库和用户历史吗？",
      ex: "导出记录", im: "导入记录", ai: "AI 分析",
      io: "导入完成，共 {{count}} 条。", if: "导入失败：{{msg}}", il: "导入文件过大（上限 {{size}}）。", iu: "导入文件结构无效。",
      sv: "设置已保存。", cl: "历史记录已清空。", sy: "正在同步...", ok: "同步成功：{{time}}",
      sf: "同步失败：{{msg}}", ew: "请先启用 WebDAV。", eb: "请填写 WebDAV 地址。",
      lg: "语言", ld: "界面语言", lz: "简体中文", le: "English", wd: "WebDAV 同步", we: "启用 WebDAV",
      ai_title: "AI 分析设置", ai_url: "API URL", ai_key: "API Key", ai_model: "模型", ai_temp: "温度",
      ai_style: "输出风格", ai_prompt: "初始提示词", ai_run: "开始分析", ai_result: "AI 分析结果",
      ai_running: "正在生成分析内容...", ai_empty: "点击“开始分析”生成结果。", ai_retry: "重新分析",
      ai_history: "AI 分析历史", ai_history_empty: "暂无 AI 分析历史。", ai_load: "加载",
      ai_followup: "追问", ai_followup_ph: "继续追问（例如：基于这份分析，给我一个 2 周学习计划）",
      ai_send: "发送", ai_need_initial: "请先点击“开始分析”再追问。",
      ai_loaded: "已加载历史分析会话。", ai_url_invalid: "AI API URL 必须是 https:// 开头的有效地址。",
      ai_default_note: "留空会自动使用默认风格与默认提示词。",
      ai_you: "你", ai_assistant: "AI",
      pb: "https://dav.example.com/path/", pu: "用户名", pp: "密码", ss: "保存设置",
      at: "关于 GitHub Trail",
      as: "你的 GitHub 访问轨迹助手",
      ad: "GitHub Trail 会在你浏览 GitHub 时，自动记录访问过的仓库与用户主页，帮助你快速回看近期关注内容。",
      am: "历史数据默认仅保存在本地浏览器，你始终可以离线使用。",
      ak: "可选启用 WebDAV 手动同步，多设备保持一致。",
      al: "内置 AI 分析与追问，帮助你从访问轨迹提炼学习和项目方向。",
      an: "只有你主动点击“同步”或“开始分析”时才会向外发送请求。",
      cd: "该操作会清空本地仓库与用户历史，AI 分析历史不会被删除。",
      tr: "仓库", tu: "用户", ut: "未知时间", ej: "远端文件不是合法 JSON。",
      eg: "WebDAV GET 失败（{{code}}）。", ep: "WebDAV PUT 失败（{{code}}）。", en: "网络请求失败。", et: "网络请求超时。",
      ae: "请先在设置中填写 AI API URL 与 API Key。",
      ai_auth_fail: "AI 鉴权失败，请检查 API Key。",
      ai_http: "AI 请求失败（HTTP {{code}}）。",
      ai_parse_fail: "AI 返回内容解析失败。",
      ta: "历史记录"
    },
    en: {
      title: "GitHub Trail", ph: "History", ps: "Settings", bs: "Open settings", bb: "Back to history", bc: "Close", ba: "About",
      ms: "Split", mm: "Merged", sr: "Repositories", su: "Users", sm: "Merged History",
      va: "View all history", vl: "Show less", nr: "No repository history yet.", nu: "No user history yet.", nh: "No history yet.",
      sn: "Sync now", ca: "Clear all history", cc: "Clear all repository and user history?",
      ex: "Export", im: "Import", ai: "AI Analysis",
      io: "Import completed: {{count}} records.", if: "Import failed: {{msg}}", il: "Import file is too large (max {{size}}).", iu: "Import file structure is invalid.",
      sv: "Settings saved.", cl: "History cleared.", sy: "Syncing...", ok: "Sync succeeded: {{time}}",
      sf: "Sync failed: {{msg}}", ew: "Enable WebDAV before syncing.", eb: "WebDAV URL is required.",
      lg: "Language", ld: "UI language", lz: "Chinese (Simplified)", le: "English", wd: "WebDAV Sync", we: "Enable WebDAV",
      ai_title: "AI Settings", ai_url: "API URL", ai_key: "API Key", ai_model: "Model", ai_temp: "Temperature",
      ai_style: "Output style", ai_prompt: "Initial prompt", ai_run: "Analyze", ai_result: "AI Result",
      ai_running: "Generating analysis...", ai_empty: "Click Analyze to generate result.", ai_retry: "Retry",
      ai_history: "AI Analysis History", ai_history_empty: "No AI analysis history yet.", ai_load: "Load",
      ai_followup: "Follow-up", ai_followup_ph: "Ask a follow-up (e.g. Build me a 2-week learning plan based on this analysis)",
      ai_send: "Send", ai_need_initial: "Run the initial analysis first.",
      ai_loaded: "Loaded historical analysis session.", ai_url_invalid: "AI API URL must be a valid https:// URL.",
      ai_default_note: "Leave blank to auto-use default style and default prompt.",
      ai_you: "You", ai_assistant: "AI",
      pb: "https://dav.example.com/path/", pu: "username", pp: "password", ss: "Save settings",
      at: "About GitHub Trail",
      as: "Your GitHub activity side companion",
      ad: "GitHub Trail records visited repositories and profiles while you browse GitHub, so you can quickly revisit what you recently explored.",
      am: "History stays in local browser storage by default and works fully offline.",
      ak: "Optional manual WebDAV sync keeps data aligned across devices.",
      al: "Built-in AI analysis and follow-up chat help turn activity trails into practical next steps.",
      an: "Network requests are sent only when you explicitly click Sync or start AI analysis.",
      cd: "This clears local repository and user history only. AI analysis history is kept.",
      tr: "Repo", tu: "User", ut: "Unknown time", ej: "Remote file is not valid JSON.",
      eg: "WebDAV GET failed ({{code}}).", ep: "WebDAV PUT failed ({{code}}).", en: "Network request failed.", et: "Network request timed out.",
      ae: "Please set AI API URL and API Key in Settings first.",
      ai_auth_fail: "AI authentication failed. Check your API key.",
      ai_http: "AI request failed (HTTP {{code}}).",
      ai_parse_fail: "Cannot parse AI response.",
      ta: "History"
    }
  };

  const SVG = {
    h: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M1 8a7 7 0 1 1 2.05 4.95l1.06-1.06A5.5 5.5 0 1 0 2.5 8H5v1.5H1.25A.75.75 0 0 1 .5 8.75V5h1.5v3Zm7-3.25a.75.75 0 0 1 .75.75V8l1.75 1.75-1.06 1.06-2-2A.75.75 0 0 1 7.25 8V5.5A.75.75 0 0 1 8 4.75Z"/></svg>',
    x: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3.72 3.72 8 8l-4.28 4.28 1.06 1.06L9.06 9.06l4.28 4.28 1.06-1.06L10.12 8l4.28-4.28-1.06-1.06L9.06 6.94 4.78 2.66Z"/></svg>',
    s: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M2 4.75A.75.75 0 0 1 2.75 4h2.11a2 2 0 0 1 3.28 0h5.11a.75.75 0 0 1 0 1.5H8.14a2 2 0 0 1-3.28 0H2.75A.75.75 0 0 1 2 4.75ZM6.5 5.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM2 11.25a.75.75 0 0 1 .75-.75h5.11a2 2 0 0 1 3.28 0h2.11a.75.75 0 0 1 0 1.5h-2.11a2 2 0 0 1-3.28 0H2.75a.75.75 0 0 1-.75-.75Zm7.5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/></svg>',
    i: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8ZM6.9 7a.75.75 0 0 1 .75-.75h.35a.75.75 0 0 1 .75.75v3.3h.35a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1 0-1.5h.25V7Z"/></svg>',
    b: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9.78 3.22 5 8l4.78 4.78-1.06 1.06L2.88 8l5.84-5.84z"/></svg>',
    g: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.39v-1.37c-2.23.5-2.7-.97-2.7-.97-.37-.95-.9-1.2-.9-1.2-.74-.5.05-.5.05-.5.82.06 1.25.84 1.25.84.72 1.26 1.9.9 2.36.69.07-.54.28-.9.5-1.1-1.78-.2-3.64-.9-3.64-4 0-.88.31-1.6.82-2.16-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.25 7.25 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.16 0 3.1-1.87 3.8-3.65 4 .29.25.55.76.55 1.53v2.27c0 .22.14.47.55.39A8 8 0 0 0 8 0Z"/></svg>'
  };

  const st = {
    d: defData(), c: defCfg(), ah: defAiHistory(),
    u: {
      mounted: false, open: false, closing: false, closeEpoch: 0, closeTimer: null, closeHandler: null, viewAnimation: null, syncing: false, view: "history", showAll: false,
      status: "", statusType: "info", topBtn: null, obs: null,
      sb: null, bd: null, title: null, tbtn: null, abtn: null, cbtn: null, body: null,
      statusNode: null, syncBtn: null, importInput: null,
      langSel: null, wEn: null, wUrl: null, wUser: null, wPass: null,
      aiUrl: null, aiKey: null, aiModel: null, aiTemp: null, aiTempVal: null, aiStyle: null, aiPrompt: null,
      aiLoading: false, aiResult: "", aiError: "", activeAiSessionId: "", aiFollowupInput: null, aiHistoryOpen: false,
      aiIssue: "",
      statusTimer: null
    },
    last: { p: "", t: 0 }
  };

  void init().catch((err) => {
    console.error("[GitHub Trail]", err);
    css(); ensureSidebar(); ensureTopbar();
    status(String(err.message || err), "error");
  });

  async function init() {
    st.d = normData(await getV(DATA_KEY, defData()));
    st.c = normCfg(await getV(CFG_KEY, defCfg()));
    st.ah = normalizeAiHistory(await getV(AI_HISTORY_KEY, defAiHistory()));
    cleanupLegacyUsers();
    watchData();
    await setV(CFG_KEY, st.c);
    await saveAiHistory();
    css();
    ensureSidebar();
    ensureTopbar();
    watchTopbar();
    bind();
    await route();

  }

  function bind() {
    const onRoute=()=>void route().catch(err=>status(err.message,"error"));
    document.addEventListener("pjax:end",onRoute);
    document.addEventListener("turbo:render",onRoute);
    document.addEventListener("turbo:load",onRoute);
    window.addEventListener("popstate",onRoute);
    window.addEventListener("load",onRoute);
    document.addEventListener("keydown",ev=>{
      if (!ev.repeat && ev.altKey && ev.shiftKey && ev.code==="KeyH") { ev.preventDefault(); toggleSidebar(); }
    });
  }

  async function route() {
    ensureTopbar();
    await record();
    if (st.u.open && st.u.view === "history") renderHistory();
  }

  function css() {
    if (st.u.root) return;
    const host = document.createElement("div");
    host.id = "github-trail-root";
    st.u.host = host;
    st.u.root = host.attachShadow({ mode: "open" });
    const el = document.createElement("style");
    el.textContent = `
:host{all:initial;position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.5;color:var(--gt-fg);--gt-bg:#ffffff;--gt-surface:#f6f8fa;--gt-hover:#eef2f6;--gt-border:#d1d9e0;--gt-fg:#1f2328;--gt-muted:#59636e;--gt-accent:#0969da;--gt-green:#1f883d;--gt-danger:#cf222e;--gt-tint:#ddf4ff;color-scheme:light}
:host([data-theme=dark]){--gt-bg:#0d1117;--gt-surface:#161b22;--gt-hover:#212830;--gt-border:#30363d;--gt-fg:#f0f6fc;--gt-muted:#919da9;--gt-accent:#79c0ff;--gt-green:#238636;--gt-danger:#ff7b72;--gt-tint:#152a40;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box} [hidden]{display:none!important} button,input,select,textarea{font:inherit;color:inherit} button,a,input,select,textarea,summary{touch-action:manipulation} button{cursor:pointer} button:disabled{opacity:.5;cursor:not-allowed} button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--gt-accent);outline-offset:2px} a{color:var(--gt-accent);text-decoration:none} a:hover{text-decoration:underline} svg{display:block;flex-shrink:0} p{margin:0 0 12px} h3{margin:0} label{display:block} input,select,textarea{min-width:0;max-width:100%} input:not([type=checkbox]):not([type=range]),select,textarea{width:100%;border:1px solid var(--gt-border);border-radius:8px;background:var(--gt-bg);padding:9px 10px;line-height:20px} textarea{resize:vertical;min-height:80px} input[type=search]::-webkit-search-cancel-button{-webkit-appearance:none} input[type=checkbox]{accent-color:var(--gt-green)} input[type=range]{width:100%;accent-color:var(--gt-green)} button{border:1px solid var(--gt-border);border-radius:8px;padding:7px 11px;background:var(--gt-bg);line-height:20px} button:hover:not(:disabled){background:var(--gt-hover)}
.gt-backdrop{pointer-events:auto;position:fixed;inset:0;background:#0005;backdrop-filter:blur(2px)} .gt-sidebar{pointer-events:auto;position:fixed;inset:0 0 0 auto;width:min(480px,100vw);height:100%;height:100dvh;background:var(--gt-bg);box-shadow:-12px 0 48px #0003;border-left:1px solid var(--gt-border);display:flex;flex-direction:column} .gt-shell{display:flex;flex-direction:column;width:100%;height:100%;min-width:0} .gt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:18px 20px;border-bottom:1px solid var(--gt-border);flex-shrink:0;background:var(--gt-bg)} .gt-brand{display:flex;align-items:center;gap:10px;font-size:16px} .gt-brand>span{color:var(--gt-muted)} .gt-head-actions{display:flex;gap:4px} .gt-head-actions button{border:0;padding:8px;display:grid;place-items:center;background:transparent;width:34px;height:34px} .gt-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:20px;scrollbar-width:thin;scrollbar-color:var(--gt-border) transparent} .gt-fab-wrap{pointer-events:auto;position:fixed;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom))} #gt-topbar-button{display:flex;align-items:center;gap:8px;border-radius:24px;padding:11px 16px;color:var(--gt-fg);background:var(--gt-bg);box-shadow:0 4px 18px #0003;border:1px solid var(--gt-border)} #gt-topbar-button svg{color:var(--gt-accent)}
.gt-intro{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:18px} .gt-eyebrow{font-size:11px;letter-spacing:1.4px;color:var(--gt-muted);font-weight:600;margin-bottom:6px} .gt-intro h2{font-size:23px;line-height:1.3;margin:0 0 6px;letter-spacing:-.5px} .gt-subtitle,.gt-ai-note,.color-fg-muted,.gt-danger-note{font-size:12px;color:var(--gt-muted)} .gt-count{font-size:12px;white-space:nowrap;color:var(--gt-muted);padding-top:5px} .gt-search{position:relative;margin-bottom:10px} .gt-search input{padding-left:34px!important;padding-right:38px!important} .gt-search>span{position:absolute;left:12px;top:9px;color:var(--gt-muted);font-size:17px} .gt-search button{position:absolute;right:4px;top:4px;border:0;background:transparent;padding:4px 8px} .gt-filter-row{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8px;margin-bottom:12px} .gt-filter-row select{font-size:12px;padding:7px 5px} .gt-view-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0 12px} .BtnGroup{display:flex;gap:3px;padding:3px;border-radius:9px;background:var(--gt-surface);border:1px solid var(--gt-border)} .BtnGroup button{border:0;font-size:12px;padding:4px 9px;background:transparent;color:var(--gt-muted)} .BtnGroup button[aria-pressed=true]{background:var(--gt-bg);color:var(--gt-fg);box-shadow:0 1px 4px #0002} .gt-star-filter{font-size:12px;padding:6px 9px;color:var(--gt-muted)} .gt-star-filter[aria-pressed=true]{color:var(--gt-accent);background:var(--gt-tint)}
.Box{border:1px solid var(--gt-border);border-radius:12px;background:var(--gt-bg);overflow:hidden} .Box-header{padding:10px 13px;background:var(--gt-surface);border-bottom:1px solid var(--gt-border);font-size:12px;color:var(--gt-muted);display:flex;align-items:center;justify-content:space-between} .Box-body{padding:14px} .gt-list-box{margin-bottom:12px} .gt-record{position:relative;display:flex;gap:10px;align-items:center;padding:12px;border-bottom:1px solid var(--gt-border)} .gt-record:last-child{border-bottom:0} .gt-record:hover{background:var(--gt-surface)} .gt-record-link{display:flex;align-items:center;gap:10px;min-width:0;flex:1;color:var(--gt-fg)} .gt-record-link:hover{text-decoration:none} .gt-record-icon{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border:1px solid var(--gt-border);background:var(--gt-surface);border-radius:8px;color:var(--gt-muted)} .gt-record-info{min-width:0;flex:1} .gt-record-name{display:block;font-size:13px;font-weight:600;overflow-wrap:anywhere} .gt-record-link:hover .gt-record-name{color:var(--gt-accent)} .gt-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--gt-muted);margin-top:5px} .gt-record-actions{display:flex;gap:1px} .gt-record-actions button{padding:5px;border:0;background:transparent;color:var(--gt-muted);width:26px;height:30px} .gt-record-actions button[aria-pressed=true]{color:var(--gt-accent)} .gt-record-actions button[data-delete]:hover{color:var(--gt-danger)} .Label{font-size:10px;border:1px solid var(--gt-border);padding:0 5px;border-radius:12px} .gt-list-empty{text-align:center;padding:32px 18px;color:var(--gt-muted);font-size:13px} .gt-list-empty strong{display:block;color:var(--gt-fg);font-size:15px;margin-bottom:6px} .gt-list-empty button{margin-top:12px} .gt-tool-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0} .gt-tool-btn{font-size:12px} .is-primary,.Button--primary{background:var(--gt-green);border-color:var(--gt-green);color:#fff} .is-primary:hover:not(:disabled),.Button--primary:hover:not(:disabled){background:var(--gt-green);filter:brightness(1.12)} .is-danger{color:var(--gt-danger)} .gt-history-tools{display:flex;flex-wrap:wrap;gap:8px;padding-top:14px;border-top:1px solid var(--gt-border)} .gt-history-tools button:last-of-type{margin-left:auto} .gt-view-all-wrap{text-align:center;margin:16px 0} .gt-view-all{width:100%;color:var(--gt-accent);font-size:12px} .gt-status{font-size:12px;padding:10px 12px;background:var(--gt-tint);border-radius:8px;overflow-wrap:anywhere;margin-bottom:12px} .gt-status:empty{display:none} .gt-status.error,.gt-ai-issue{color:var(--gt-danger);background:var(--gt-surface)} .gt-undo{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;margin-bottom:12px;background:var(--gt-tint);border-radius:8px;font-size:12px}
.gt-settings-grid{display:grid;gap:12px} .gt-settings-grid label{font-size:12px;font-weight:600} .gt-settings-grid label>input,.gt-settings-grid label>select,.gt-settings-grid label>textarea{display:block;margin-top:6px;font-weight:400} .gt-settings-grid .gt-check{display:flex;gap:8px;align-items:center;font-weight:400} .gt-settings-grid .gt-check input{margin:0} .gt-settings-section{margin-bottom:14px} details.Box>summary{list-style:none;cursor:pointer;padding:14px;font-weight:600;background:var(--gt-surface)} details.Box>summary::after{content:'+';float:right;color:var(--gt-muted)} details.Box[open]>summary::after{content:'−'} .gt-settings-actions{position:sticky;bottom:-20px;padding:12px 0 20px;background:var(--gt-bg);display:flex;gap:10px} .gt-settings-actions button{flex:1} .gt-settings-danger{margin-top:20px;border-top:1px solid var(--gt-border);padding:16px 0}.gt-danger-note{margin-bottom:10px} .gt-ai-note{line-height:1.7;margin-bottom:10px}.gt-ai-issue{padding:12px;border:1px solid var(--gt-border);border-radius:8px;margin:12px 0;font-size:12px}
.gt-ai-box{padding:20px;border:1px solid var(--gt-border);border-radius:12px;background:var(--gt-surface)} .gt-chat-list{display:flex;flex-direction:column;gap:14px} .gt-chat-msg{padding:12px;border:1px solid var(--gt-border);border-radius:12px;min-width:0}.gt-chat-msg.is-user{background:var(--gt-tint)} .gt-chat-role{font-size:11px;color:var(--gt-muted);margin-bottom:8px}.gt-chat-content{font-size:13px;line-height:1.7;overflow-wrap:anywhere}.gt-chat-content p:last-child{margin:0}.gt-chat-content pre{overflow:auto;background:var(--gt-surface);padding:10px;border-radius:8px;white-space:pre-wrap}.gt-chat-content code{font-family:ui-monospace,Consolas,monospace;font-size:12px}.gt-chat-content ul,.gt-chat-content ol{padding-left:20px}.gt-chat-content h1,.gt-chat-content h2,.gt-chat-content h3{font-size:16px;margin:14px 0 8px}.gt-ai-thread-viewport{min-width:0}.gt-ai-followup{display:grid;gap:8px;margin-top:18px}.gt-ai-history{border:1px solid var(--gt-border);border-radius:10px;margin-bottom:14px}.gt-ai-history summary{padding:10px;font-size:12px;color:var(--gt-muted);cursor:pointer}.gt-ai-history-list{padding:10px;display:grid;gap:8px;max-height:240px;overflow:auto}.gt-ai-history-item{padding:10px;border:1px solid var(--gt-border);border-radius:8px}.gt-ai-history-item .meta{color:var(--gt-muted);font-size:11px;margin:5px 0}.gt-about-wrap{display:grid;gap:14px}.gt-about-card{padding:18px;border:1px solid var(--gt-border);border-radius:12px;background:var(--gt-surface)}.gt-about-hero{display:flex;align-items:center;gap:14px}.gt-about-logo{width:54px;height:54px;border-radius:12px}.gt-about-title{font-size:18px}.gt-about-sub,.gt-about-version{font-size:12px;color:var(--gt-muted);margin:6px 0}.gt-about-text{font-size:13px;line-height:1.8}.gt-about-list{padding-left:18px}.gt-about-list li{margin:8px 0}.mb-2{margin-bottom:8px}.mb-3{margin-bottom:14px}.text-small{font-size:12px}
@media(max-width:380px){.gt-body{padding:14px}.gt-head{padding:14px}.gt-filter-row{gap:5px}.gt-record{padding:10px;gap:5px}.gt-record-icon{display:none}.gt-settings-actions{bottom:-14px}.gt-intro h2{font-size:21px}.gt-fab-wrap{right:12px;bottom:12px}}

/* Motion is limited to transforms, opacity and interaction feedback. */
:host{--gt-ease:cubic-bezier(.22,1,.36,1);--gt-danger-tint:#fff1f0;--gt-row-hover:#f0f6fc}
:host([data-theme=dark]){--gt-danger-tint:#382022;--gt-row-hover:#172331}
.gt-sidebar{transform:translateX(100%);transition:transform 210ms cubic-bezier(.4,0,.2,1)}
.gt-sidebar.is-open{transform:translateX(0);transition-duration:300ms;transition-timing-function:var(--gt-ease)}
.gt-sidebar.is-closing{pointer-events:none}
.gt-backdrop{opacity:0;transition:opacity 180ms ease}
.gt-backdrop.is-open{opacity:1;transition-duration:240ms}
button{transition:background-color 150ms ease,border-color 150ms ease,color 150ms ease,box-shadow 150ms ease,transform 120ms ease,filter 150ms ease}
button:active:not(:disabled){transform:scale(.96);box-shadow:none}
.gt-head-actions button{border-radius:9px}
.gt-record{transition:background-color 160ms ease,box-shadow 160ms ease}
.gt-record-icon{transition:background-color 160ms ease,border-color 160ms ease,color 160ms ease,transform 160ms var(--gt-ease)}
.gt-record-name{transition:color 150ms ease}
.gt-record-actions button{width:30px;height:30px;border-radius:7px}
.gt-record:focus-within{background:var(--gt-row-hover);box-shadow:inset 3px 0 var(--gt-accent)}
.gt-record-actions button[aria-pressed=true]{background:var(--gt-tint)}
#gt-topbar-button{transition:transform 180ms var(--gt-ease),box-shadow 180ms ease,border-color 150ms ease,background-color 150ms ease}
#gt-topbar-button svg{transition:transform 200ms var(--gt-ease)}
input:not([type=checkbox]):not([type=range]),select,textarea{transition:border-color 150ms ease,box-shadow 150ms ease}
input:not([type=checkbox]):not([type=range]):focus,select:focus,textarea:focus{border-color:var(--gt-accent);box-shadow:0 0 0 3px var(--gt-tint)}
summary{border-radius:8px;transition:background-color 150ms ease,color 150ms ease}
details.Box>summary::after{transition:color 150ms ease}
@media(hover:hover){
  .gt-head-actions button:hover:not(:disabled){background:var(--gt-tint);color:var(--gt-accent);transform:translateY(-1px)}
  .gt-head-actions #gt-close:hover{background:var(--gt-danger-tint);color:var(--gt-danger)}
  .gt-record:hover{background:var(--gt-row-hover);box-shadow:inset 3px 0 var(--gt-accent)}
  .gt-record:hover .gt-record-icon{background:var(--gt-tint);color:var(--gt-accent);border-color:var(--gt-accent);transform:translateY(-1px)}
  .gt-record-link:hover .gt-record-name{color:var(--gt-accent)}
  .gt-record-actions button:hover:not(:disabled){background:var(--gt-tint);color:var(--gt-accent);transform:scale(1.08)}
  .gt-record-actions button[data-delete]:hover:not(:disabled){background:var(--gt-danger-tint);color:var(--gt-danger)}
  .gt-tool-btn:hover:not(:disabled),.gt-settings-actions button:hover:not(:disabled),.gt-star-filter:hover,.gt-view-all:hover{border-color:var(--gt-accent);box-shadow:0 2px 6px #0001;transform:translateY(-1px)}
  .BtnGroup button[aria-pressed=false]:hover{background:var(--gt-hover);color:var(--gt-fg)}
  #gt-topbar-button:hover{background:var(--gt-surface);border-color:var(--gt-accent);box-shadow:0 8px 24px #0003;transform:translateY(-2px)}
  #gt-topbar-button:hover svg{transform:rotate(-12deg)}
  details.Box>summary:hover,.gt-ai-history summary:hover{background:var(--gt-hover);color:var(--gt-accent)}
  .gt-settings-grid summary:hover{color:var(--gt-accent)}
}
/* Pressed feedback wins over hover, including on touch screens. */
.gt-head-actions button:active:not(:disabled),.gt-record-actions button:active:not(:disabled),.gt-tool-btn:active:not(:disabled),#gt-topbar-button:active{transform:scale(.95);box-shadow:none}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}
  button,.gt-record-icon,#gt-topbar-button svg{transform:none!important}
}

`;
    st.u.root.appendChild(el);
    document.body.appendChild(host);
    applyTheme();
  }

  function tr(zh, en) { return st.c.language === "en" ? en : zh; }

  function applyTheme() {
    if (!st.u.host) return;
    const html = document.documentElement;
    const mode = html.dataset.colorMode;
    const dark = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const theme = st.c.ui.theme || "auto";
    st.u.host.dataset.theme = theme === "auto" ? (dark ? "dark" : "light") : theme;
    st.u.host.lang = st.c.language;
  }

  function ensureSidebar() {
    if (st.u.mounted) return;
    const bd = document.createElement("div");
    bd.className = "gt-backdrop"; bd.hidden = true;
    bd.addEventListener("click", closeSidebar);
    const sb = document.createElement("aside");
    sb.className = "gt-sidebar"; sb.id = "gt-sidebar"; sb.hidden = true;
    sb.setAttribute("role", "dialog"); sb.setAttribute("aria-modal", "true"); sb.setAttribute("aria-labelledby", "gt-title");
    sb.innerHTML = `<div class="gt-shell"><header class="gt-head"><div class="gt-brand"><span>${SVG.h}</span><strong id="gt-title"></strong></div><div class="gt-head-actions"><button id="gt-toggle" type="button"></button><button id="gt-about" type="button"></button><button id="gt-close" type="button"></button></div></header><div id="gt-body" class="gt-body"></div></div>`;
    st.u.root.append(bd, sb);
    Object.assign(st.u, { bd, sb, title:sb.querySelector("#gt-title"), tbtn:sb.querySelector("#gt-toggle"), abtn:sb.querySelector("#gt-about"), cbtn:sb.querySelector("#gt-close"), body:sb.querySelector("#gt-body"), mounted:true });
    st.u.tbtn.addEventListener("click", handleToggleAction);
    st.u.abtn.addEventListener("click", handleAboutAction);
    st.u.cbtn.addEventListener("click", closeSidebar);
    sb.addEventListener("keydown", (ev) => {
      // Keep GitHub's single-key shortcuts away from the panel's inputs.
      ev.stopPropagation();
      if (!ev.repeat && ev.altKey && ev.shiftKey && ev.code === "KeyH") { ev.preventDefault(); toggleSidebar(); return; }
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); closeSidebar(); }
      if (ev.key === "Tab") {
        const items = [...sb.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
        const first=items[0], last=items.at(-1), active=st.u.root.activeElement;
        if (ev.shiftKey && active===first) { ev.preventDefault(); last?.focus(); }
        else if (!ev.shiftKey && active===last) { ev.preventDefault(); first?.focus(); }
      }
    });
    st.u.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    st.u.motionQuery.addEventListener("change", () => {
      if (!st.u.motionQuery.matches) return;
      st.u.viewAnimation?.cancel();
      if (st.u.closing) finishSidebarClose(st.u.closeEpoch);
    });
    renderSidebar();
  }

  function handleToggleAction() {
    if (st.u.view === "history") {
      switchView("settings");
      return;
    }
    switchView("history");
  }

  function handleAboutAction() {
    if (st.u.view === "about") {
      switchView("history");
      return;
    }
    switchView("about");
  }

  function ensureTopbar() {
    if (!st.u.root) return;
    if (!st.u.host.isConnected) document.body.appendChild(st.u.host);
    const wrap = getWrap(), btn = getBtn();
    if (!wrap.contains(btn)) wrap.appendChild(btn);
    wrap.classList.add("gt-fab-wrap"); wrap.hidden = st.u.open || st.u.closing;
    if (!wrap.isConnected) st.u.root.appendChild(wrap);
  }

  function watchTopbar() {
    if (st.u.obs) return;
    let scheduled = false, path = location.pathname;
    st.u.obs = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false; ensureTopbar(); applyTheme();
        if (path !== location.pathname) { path=location.pathname; void route().catch(err => status(err.message,"error")); }
      });
    });
    st.u.obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["data-color-mode","data-dark-theme","data-light-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  }

  function getWrap() {
    let w = st.u.root.querySelector("#gt-topbar-wrap");
    if (!w) { w=document.createElement("div"); w.id="gt-topbar-wrap"; }
    return w;
  }

  function getBtn() {
    let b = st.u.topBtn;
    if (!b) {
      b=document.createElement("button"); b.id="gt-topbar-button"; b.type="button";
      b.innerHTML = `${SVG.h}<span>Trail</span>`;
      b.addEventListener("click",toggleSidebar); st.u.topBtn=b;
    }
    b.title=t("ta"); b.setAttribute("aria-label",t("ta")); b.setAttribute("aria-haspopup","dialog");
    b.setAttribute("aria-expanded",String(st.u.open)); b.setAttribute("aria-controls","gt-sidebar");
    return b;
  }

  function visible(n) {
    if (!n) return false;
    const s = window.getComputedStyle(n);
    if (s.display === "none" || s.visibility === "hidden") return false;
    return n.getClientRects().length > 0;
  }

  function toggleSidebar() {
    if (st.u.open) closeSidebar();
    else openSidebar();
  }

  function openSidebar() {
    if (st.u.open) return;
    ensureSidebar();
    const reversing = st.u.closing;
    cancelSidebarClose();
    // A reversed exit still owns the original focus and background lock.
    if (!reversing) {
      st.u.previousFocus = document.activeElement;
      st.u.oldOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      st.u.inertNodes = [...document.body.children].filter(node => node !== st.u.host && !node.inert);
      st.u.inertNodes.forEach(node => { node.inert = true; });
    }
    st.u.open = true;
    st.u.sb.hidden = false;
    st.u.bd.hidden = false;
    if (!reversing) {
      renderSidebar();
      // Establish the off-screen starting style before enabling the transition.
      void st.u.sb.offsetWidth;
    }
    st.u.sb.classList.add("is-open");
    st.u.bd.classList.add("is-open");
    ensureTopbar();
    (st.u.body.querySelector("#gt-search") || st.u.cbtn).focus({ preventScroll: true });
  }

  function cancelSidebarClose() {
    st.u.closeEpoch += 1;
    clearTimeout(st.u.closeTimer);
    st.u.closeTimer = null;
    if (st.u.closeHandler) st.u.sb.removeEventListener("transitionend", st.u.closeHandler);
    st.u.closeHandler = null;
    st.u.closing = false;
    st.u.sb.classList.remove("is-closing");
  }

  function finishSidebarClose(epoch) {
    if (epoch !== st.u.closeEpoch || st.u.open || !st.u.closing) return;
    cancelSidebarClose();
    st.u.sb.hidden = true;
    st.u.bd.hidden = true;
    document.body.style.overflow = st.u.oldOverflow || "";
    st.u.inertNodes?.forEach(node => { node.inert = false; });
    st.u.inertNodes = [];
    ensureTopbar();
    const previous = st.u.previousFocus;
    if (previous?.isConnected && previous !== document.body && previous !== st.u.host) previous.focus({ preventScroll: true });
    else st.u.topBtn?.focus({ preventScroll: true });
  }

  function closeSidebar() {
    if (!st.u.open) return;
    st.u.open = false;
    st.u.closing = true;
    st.u.viewAnimation?.cancel();
    const epoch = ++st.u.closeEpoch;
    st.u.sb.classList.add("is-closing");
    st.u.sb.classList.remove("is-open");
    st.u.bd.classList.remove("is-open");
    ensureTopbar();
    if (st.u.motionQuery.matches) {
      finishSidebarClose(epoch);
      return;
    }
    st.u.closeHandler = event => {
      if (event.target === st.u.sb && event.propertyName === "transform") finishSidebarClose(epoch);
    };
    st.u.sb.addEventListener("transitionend", st.u.closeHandler);
    // Covers interrupted transitions, background tabs and missing transitionend.
    st.u.closeTimer = setTimeout(() => finishSidebarClose(epoch), 340);
  }

  function renderSidebar(animate = false, direction = 1) {
    if (!st.u.mounted) return;
    const isHistory = st.u.view === "history";
    const isSettings = st.u.view === "settings";
    const isAbout = st.u.view === "about";
    const isAnalysis = st.u.view === "analysis";

    st.u.title.textContent = isSettings
      ? t("ps")
      : isAbout
        ? t("ba")
        : isAnalysis
          ? t("ai_result")
          : t("ph");

    st.u.tbtn.innerHTML = isHistory ? SVG.s : SVG.b;
    st.u.tbtn.title = isHistory ? t("bs") : t("bb");
    st.u.tbtn.setAttribute("aria-label", isHistory ? t("bs") : t("bb"));

    if (isAbout || isSettings || isAnalysis) {
      st.u.abtn.style.display = "none";
    } else {
      st.u.abtn.style.display = "";
      st.u.abtn.innerHTML = SVG.i;
      st.u.abtn.title = t("ba");
      st.u.abtn.setAttribute("aria-label", t("ba"));
    }

    st.u.cbtn.innerHTML = SVG.x;
    st.u.cbtn.title = t("bc");
    st.u.cbtn.setAttribute("aria-label", t("bc"));
    if (isSettings) renderSettings();
    else if (isAbout) renderAbout();
    else if (isAnalysis) renderAnalysis();
    else renderHistory();
    if (animate) triggerViewAnimation(direction);
  }

  function renderHistory() {
    const search=st.u.search || "", type=st.u.type || "all", period=st.u.period || "all", order=st.u.order || "recent";
    const items=[...Object.values(st.d.repo).map(x=>({...x,__t:"repo"})),...Object.values(st.d.user).map(x=>({...x,__t:"user"}))];
    const cutoff=period==="all" ? 0 : Date.now()-(period==="week" ? 7 : 30)*86400000;
    const terms=search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const filtered=items.filter(x=>(type==="all" || x.__t===type) && (!st.u.pinnedOnly || x.pinned) && ts(x.lastVisitedAt)>=cutoff && terms.every(q=>`${x.owner||""}/${x.repo||""} ${x.username||""}`.toLowerCase().includes(q)));
    filtered.sort((a,b)=>order==="visits" ? b.visitCount-a.visitCount || ts(b.lastVisitedAt)-ts(a.lastVisitedAt) : order==="name" ? a.key.localeCompare(b.key) : ts(b.lastVisitedAt)-ts(a.lastVisitedAt));
    const limit=st.u.limit || 30, mode=st.c.ui.listMode;
    const shown=filtered.slice(0,limit);
    const group=(title,list)=>`<section class="Box gt-list-box"><div class="Box-header"><strong>${e(title)}</strong><span>${list.length}</span></div>${rows(list,mode)}</section>`;
    const body=shown.length ? mode==="merged" ? group(tr("最近的足迹","Your trail"),shown) : ["repo","user"].map(kind=>{const list=shown.filter(x=>x.__t===kind);return list.length ? group(t(kind==="repo"?"sr":"su"),list):"";}).join("") : `<div class="Box gt-list-empty"><strong>${e(items.length ? tr("没有找到匹配记录","No matching history") : tr("从下一次探索开始","Your next discovery starts here"))}</strong>${e(items.length ? tr("试试其他关键词，或清除筛选条件。","Try another keyword or clear your filters.") : tr("浏览 GitHub 仓库和用户主页后，足迹会自动出现在这里。","Visit a repository or profile and it will appear here."))}${items.length ? `<br><button id="gt-reset">${e(tr("清除筛选","Clear filters"))}</button>`:""}</div>`;
    st.u.body.innerHTML=`
<div class="gt-intro"><div><div class="gt-eyebrow">GITHUB TRAIL</div><h2>${e(tr("找回你的探索","Pick up your trail"))}</h2><div class="gt-subtitle">${e(st.c.recordingPaused ? tr("记录已暂停 · 已有足迹仍可查看","Recording paused · Your history is still here") : tr("每次发现，都有迹可循。","Every discovery, easy to find again."))}</div></div><span class="gt-count">${items.length} ${e(tr("条足迹","saved"))}</span></div>
<div id="gt-status" role="status" aria-live="polite" class="gt-status ${e(st.u.statusType)}"></div>
${st.u.deleted ? `<div class="gt-undo"><span>${e(tr("已移除一条记录","Record removed"))}</span><button id="gt-undo" type="button" ${st.u.syncing?"disabled":""}>${e(tr("撤销","Undo"))}</button></div>`:""}
<div class="gt-search"><span aria-hidden="true">⌕</span><input id="gt-search" type="search" autocomplete="off" aria-label="${e(tr("搜索历史记录","Search history"))}" placeholder="${e(tr("搜索仓库、作者或用户…","Search repositories, owners, or users…"))}" value="${e(search)}"><button id="gt-search-clear" type="button" aria-label="${e(tr("清空搜索","Clear search"))}" ${search?"":"hidden"}>×</button></div>
<div class="gt-filter-row"><select id="gt-type" aria-label="${e(tr("记录类型","Record type"))}"><option value="all">${e(tr("全部类型","All types"))}</option><option value="repo">${e(t("sr"))}</option><option value="user">${e(t("su"))}</option></select><select id="gt-period" aria-label="${e(tr("时间范围","Time range"))}"><option value="all">${e(tr("全部时间","All time"))}</option><option value="week">${e(tr("最近 7 天","Last 7 days"))}</option><option value="month">${e(tr("最近 30 天","Last 30 days"))}</option></select><select id="gt-sort" aria-label="${e(tr("排序方式","Sort by"))}"><option value="recent">${e(tr("最近访问","Recently visited"))}</option><option value="visits">${e(tr("访问次数","Most visited"))}</option><option value="name">${e(tr("名称排序","Name A–Z"))}</option></select></div>
<div class="gt-view-row"><div class="BtnGroup"><button id="gt-mm" aria-pressed="${mode==="merged"}">${e(tr("全部足迹","Timeline"))}</button><button id="gt-ms" aria-pressed="${mode==="split"}">${e(tr("按类型","By type"))}</button></div><button id="gt-pinned" class="gt-star-filter" aria-pressed="${!!st.u.pinnedOnly}">☆ ${e(tr("收藏","Favorites"))}</button></div>
${body}
${filtered.length>shown.length ? `<div class="gt-view-all-wrap"><button id="gt-va" class="gt-view-all">${e(tr("加载更多","Load more"))} · ${shown.length} / ${filtered.length}</button></div>`:""}
<div class="gt-history-tools"><button id="gt-export" class="gt-tool-btn">${e(t("ex"))}</button><button id="gt-import" class="gt-tool-btn">${e(t("im"))}</button>${st.c.webdav.enabled?`<button id="gt-sync" class="gt-tool-btn">${e(t("sn"))}</button>`:""}<button id="gt-ai" class="gt-tool-btn is-primary">${e(t("ai"))}</button><input id="gt-import-file" type="file" accept=".json,application/json" hidden></div>
<div class="gt-ai-note" style="margin-top:12px">${e(tr("数据保存在本地 · Alt + Shift + H 打开 / 关闭","Stored locally · Alt + Shift + H to open / close"))}</div>`;
    const q=sel=>st.u.body.querySelector(sel);
    Object.assign(st.u,{statusNode:q("#gt-status"),syncBtn:q("#gt-sync"),importInput:q("#gt-import-file")});
    q("#gt-type").value=type; q("#gt-period").value=period; q("#gt-sort").value=order;
    paintStatus(); syncBtnState(st.u.syncing);
    const updateSearch=ev=>{
      if (ev.isComposing) return;
      const value=ev.target.value, position=ev.target.selectionStart;
      st.u.search=value; st.u.limit=30; renderHistory();
      const input=q("#gt-search"); input.focus(); if (position!==null) input.setSelectionRange(position,position);
    };
    q("#gt-search").addEventListener("input",updateSearch);
    q("#gt-search").addEventListener("compositionend",updateSearch);
    q("#gt-search-clear").addEventListener("click",()=>{st.u.search="";st.u.limit=30;renderHistory();q("#gt-search").focus();});
    for (const [id,key] of [["type","type"],["period","period"],["sort","order"]]) q(`#gt-${id}`).addEventListener("change",ev=>{st.u[key]=ev.target.value;st.u.limit=30;renderHistory();q(`#gt-${id}`).focus();});
    q("#gt-pinned").addEventListener("click",()=>{st.u.pinnedOnly=!st.u.pinnedOnly;st.u.limit=30;renderHistory();q("#gt-pinned").focus();});
    q("#gt-reset")?.addEventListener("click",()=>{Object.assign(st.u,{search:"",type:"all",period:"all",pinnedOnly:false,limit:30});renderHistory();q("#gt-search").focus();});
    q("#gt-ms").addEventListener("click",()=>void setMode("split")); q("#gt-mm").addEventListener("click",()=>void setMode("merged"));
    q("#gt-va")?.addEventListener("click",()=>{st.u.limit=limit+30;renderHistory();});
    q("#gt-sync")?.addEventListener("click",()=>void syncNow());
    q("#gt-export").addEventListener("click",exportHistory);
    q("#gt-import").addEventListener("click",()=>st.u.importInput.click());
    st.u.importInput.addEventListener("change",()=>void importHistory());
    q("#gt-ai").addEventListener("click",openAnalysisView);
    q("#gt-undo")?.addEventListener("click",()=>void editRecord("undo"));
    st.u.body.querySelectorAll("[data-delete],[data-pin]").forEach(btn=>btn.addEventListener("click",()=>void editRecord(btn.hasAttribute("data-pin")?"pin":"delete",btn.dataset.type,btn.dataset.key)));
  }

  async function editRecord(action, type, key) {
    if (st.u.syncing) return status(tr("同步完成后再修改记录。","Wait for sync to finish before editing history."),"error");
    let deleted=st.u.deleted;
    try {
      await mutateData(next => {
        if (action==="undo" && deleted) {
          if (!Object.hasOwn(next[deleted.type], deleted.record.key)) next[deleted.type][deleted.record.key]=deleted.record;
          deleted=null;
        } else if (next[type] && Object.hasOwn(next[type], key)) {
          if (action==="pin") next[type][key].pinned=!next[type][key].pinned;
          else {deleted={type,record:next[type][key]};delete next[type][key];}
        }
      });
      st.u.deleted=deleted; renderHistory();
      (st.u.body.querySelector(action==="delete"?"#gt-undo":"#gt-search"))?.focus();
    } catch(err){status(err.message,"error");}
  }

  function renderSettings() {
    st.u.body.innerHTML=`<form id="gt-settings-form" novalidate>
<div id="gt-status" role="status" aria-live="polite" class="gt-status"></div>
<section class="Box gt-settings-section"><div class="Box-header"><strong>${e(tr("常用设置","General"))}</strong></div><div class="Box-body gt-settings-grid">
<label for="gt-lang">${e(t("lg"))}<select id="gt-lang"><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
<label for="gt-theme">${e(tr("外观","Appearance"))}<select id="gt-theme"><option value="auto">${e(tr("跟随 GitHub / 系统","Follow GitHub / system"))}</option><option value="light">${e(tr("浅色","Light"))}</option><option value="dark">${e(tr("深色","Dark"))}</option></select></label>
<label class="gt-check"><input id="gt-paused" type="checkbox">${e(tr("暂停记录新的访问","Pause recording new visits"))}</label>
<div class="gt-ai-note">${e(tr("自动记录仓库及其子页面、用户主页；每类最多保留 500 条。","Records repositories (including subpages) and profiles, up to 500 per type."))}</div>
</div></section>
<details class="Box gt-settings-section" ${st.c.webdav.enabled?"open":""}><summary>${e(t("wd"))} · ${e(tr("可选","Optional"))}</summary><div class="Box-body gt-settings-grid">
<div class="gt-ai-note">${e(tr("手动合并远端记录，不会自动上传。请填写已有的 WebDAV 文件夹地址。删除只影响本地；再次同步可能恢复远端记录。","Manual merge only; no automatic uploads. Enter an existing WebDAV folder URL. Deletions are local and remote records may return on sync."))}</div>
<label class="gt-check"><input id="gt-we" type="checkbox">${e(t("we"))}</label>
<label for="gt-wu">${e(tr("WebDAV 地址（HTTPS）","WebDAV URL (HTTPS)"))}<input id="gt-wu" type="url" placeholder="${e(t("pb"))}"></label>
<label for="gt-wn">${e(t("pu"))}<input id="gt-wn" autocomplete="off"></label>
<label for="gt-wp">${e(t("pp"))}<input id="gt-wp" type="password" autocomplete="new-password"></label>
</div></details>
<details id="gt-ai-config" class="Box gt-settings-section"><summary>${e(t("ai_title"))} · ${e(tr("可选","Optional"))}</summary><div class="Box-body gt-settings-grid">
<div class="gt-ai-note">${e(tr("支持 Chat Completions 兼容接口。只有主动分析或追问时才发送历史摘要和对话。","Supports Chat Completions compatible APIs. History summaries and conversation are sent only when you analyze or ask a follow-up."))}</div>
<label for="gt-ai-url">${e(t("ai_url"))}<input id="gt-ai-url" type="url" placeholder="https://api.example.com/v1/chat/completions"></label>
<label for="gt-ai-key">${e(t("ai_key"))}<input id="gt-ai-key" type="password" autocomplete="new-password" placeholder="sk-..."></label>
<label for="gt-ai-model">${e(t("ai_model"))}<input id="gt-ai-model" placeholder="gpt-4o-mini"></label>
<details><summary class="text-small">${e(tr("高级选项","Advanced options"))}</summary><div class="gt-settings-grid" style="margin-top:12px"><label for="gt-ai-temp">${e(t("ai_temp"))}: <span id="gt-ai-temp-val">0.7</span><input id="gt-ai-temp" type="range" min="0" max="2" step="0.1"></label><label for="gt-ai-style">${e(t("ai_style"))}<textarea id="gt-ai-style"></textarea></label><label for="gt-ai-prompt">${e(t("ai_prompt"))}<textarea id="gt-ai-prompt"></textarea></label></div></details>
</div></details>
<div class="gt-settings-actions"><button id="gt-save" type="submit" class="is-primary">${e(t("ss"))}</button></div>
</form>
<div class="gt-settings-danger"><div class="gt-danger-note">${e(t("cd"))}</div><button id="gt-clear-settings" type="button" class="gt-tool-btn is-danger" ${st.u.syncing?"disabled":""}>${e(t("ca"))}</button></div>`;
    const q=sel=>st.u.body.querySelector(sel);
    const fields={statusNode:"status",langSel:"lang",wEn:"we",wUrl:"wu",wUser:"wn",wPass:"wp",aiUrl:"ai-url",aiKey:"ai-key",aiModel:"ai-model",aiTemp:"ai-temp",aiTempVal:"ai-temp-val",aiStyle:"ai-style",aiPrompt:"ai-prompt"};
    for (const [key,id] of Object.entries(fields)) st.u[key]=q(`#gt-${id}`);
    st.u.syncBtn=null; fillSettings(); paintStatus();
    q("#gt-theme").value=st.c.ui.theme || "auto"; q("#gt-paused").checked=!!st.c.recordingPaused;
    st.u.aiTemp.addEventListener("input",()=>st.u.aiTempVal.textContent=st.u.aiTemp.value);
    const form=q("#gt-settings-form");
    for (const [id,value] of Object.entries(st.u.settingsDraft || {})) {
      const field=form.querySelector(`#${id}`);
      if (field) { if (field.type==="checkbox") field.checked=value; else field.value=value; }
    }
    st.u.aiTempVal.textContent=st.u.aiTemp.value;
    form.addEventListener("input",()=>{
      st.u.settingsDraft=Object.fromEntries([...form.querySelectorAll("input,select,textarea")].map(field=>[field.id,field.type==="checkbox"?field.checked:field.value]));
    });
    q("#gt-settings-form").addEventListener("submit",ev=>{ev.preventDefault();void saveSettings(false);});
    q("#gt-clear-settings").addEventListener("click",()=>void clearAll().catch(err=>status(err.message,"error")));
  }

  function renderAbout() {
    st.u.body.innerHTML =
`<div class="gt-about-wrap">
  <div class="gt-about-card gt-about-hero">
    <div class="gt-about-logo-wrap">
      <img id="gt-about-logo" class="gt-about-logo" src="${e(LOGO_DATA_URL)}" alt="${e(t("title"))}" draggable="false" />
    </div>
    <div>
      <h3 class="gt-about-title">${e(t("at"))}</h3>
      <p class="gt-about-sub">${e(t("as"))}</p>
    </div>
  </div>
  <div class="gt-about-card gt-about-text">
    <p>${e(t("ad"))}</p>
    <p>${e(t("am"))}</p>
    <ul class="gt-about-list">
      <li>${e(t("ak"))}</li>
      <li>${e(t("al"))}</li>
      <li>${e(t("an"))}</li>
    </ul>
    <div class="gt-about-version">Version: 1.2.1</div>
  </div>
</div>`;
    st.u.statusNode = null;
    st.u.syncBtn = null;
    const logo = st.u.body.querySelector("#gt-about-logo");
    logo?.addEventListener("dragstart", (ev) => ev.preventDefault());
    logo?.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }

  function renderAnalysis() {
    const session = getActiveAiSession();
    const hasSession = !!session;
    const runLabel = hasSession ? t("ai_retry") : t("ai_run");
    const runDisabled = st.u.aiLoading ? "disabled" : "";

    const historyHtml = st.ah.sessions.length
      ? st.ah.sessions.map((x) => {
        const sid = e(x.id);
        const title = e(x.title || t("ai_result"));
        const updated = e(fmt(x.updatedAt));
        return `<div class="gt-ai-history-item">
          <div class="text-small">${title}</div>
          <div class="meta">${updated}</div>
          <button type="button" class="gt-tool-btn" data-gt-ai-load="${sid}" ${st.u.aiLoading ? "disabled" : ""}>${e(t("ai_load"))}</button>
        </div>`;
      }).join("")
      : `<div class="text-small color-fg-muted">${e(t("ai_history_empty"))}</div>`;

    const detailsOpen = st.u.aiHistoryOpen ? " open" : "";
    const bodyHtml = st.u.aiLoading
      ? `<div class="gt-ai-box text-small color-fg-muted">${e(t("ai_running"))}</div>`
      : hasSession
        ? renderAiConversation(session.messages)
        : `<div class="gt-ai-box text-small color-fg-muted">${e(t("ai_empty"))}</div>`;

    const followupDisabled = st.u.aiLoading || !hasSession ? "disabled" : "";
    st.u.body.innerHTML =
`<div class="gt-ai-note">${e(tr("分析会将最近最多 80 个仓库和 80 位用户的访问摘要发送到你配置的 AI 服务。", "Analysis sends summaries of up to 80 recent repositories and 80 profiles to your configured AI service."))}</div>
${st.u.aiError ? `<div role="alert" class="gt-ai-issue">${e(st.u.aiError)}</div>` : ""}
<details id="gt-ai-history" class="gt-ai-history"${detailsOpen}>
  <summary>${e(t("ai_history"))}</summary>
  <div class="gt-ai-history-list">${historyHtml}</div>
</details>
<div class="gt-tool-row">
  <button id="gt-ai-run" type="button" class="gt-tool-btn is-primary" ${runDisabled}>${e(runLabel)}</button>
  <button id="gt-ai-settings" type="button" class="gt-tool-btn">${e(tr("配置 AI 服务", "Configure AI"))}</button>
</div>
<div class="gt-ai-thread-viewport">
  ${bodyHtml}
</div>
<div class="gt-ai-followup">
  <label for="gt-ai-followup" class="text-small color-fg-muted">${e(t("ai_followup"))} · Ctrl / ⌘ + Enter</label>
  <textarea id="gt-ai-followup" class="form-control input-block" placeholder="${e(t("ai_followup_ph"))}" ${followupDisabled}></textarea>
  <div><button id="gt-ai-send" type="button" class="gt-tool-btn" ${followupDisabled}>${e(t("ai_send"))}</button></div>
</div>
<div id="gt-status" class="gt-status ${e(st.u.statusType)}"></div>`;
    st.u.statusNode = st.u.body.querySelector("#gt-status");
    st.u.syncBtn = null;
    st.u.aiFollowupInput = st.u.body.querySelector("#gt-ai-followup");
    st.u.aiFollowupInput.value = st.u.aiDraft || "";
    st.u.aiFollowupInput.addEventListener("input", () => { st.u.aiDraft = st.u.aiFollowupInput.value; });
    st.u.body.querySelector("#gt-ai-settings").addEventListener("click", () => {
      switchView("settings");
      requestAnimationFrame(() => { const detail=st.u.body.querySelector("#gt-ai-config"); if (detail) {detail.open=true; detail.scrollIntoView({block:"start"}); st.u.aiUrl?.focus();} });
    });
    paintStatus();
    st.u.body.querySelector("#gt-ai-run")?.addEventListener("click", () => void runAiAnalysisInitial());
    st.u.body.querySelector("#gt-ai-send")?.addEventListener("click", () => void runAiFollowup());
    st.u.aiFollowupInput?.addEventListener("keydown", (ev) => {
      if (!ev.isComposing && ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        void runAiFollowup();
      }
    });
    st.u.body.querySelector("#gt-ai-history")?.addEventListener("toggle", (ev) => {
      st.u.aiHistoryOpen = !!ev.currentTarget.open;
    });
    st.u.body.querySelectorAll("[data-gt-ai-load]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = String(btn.getAttribute("data-gt-ai-load") || "");
        if (loadAiSession(sid)) status(t("ai_loaded"), "info", 1200);
      });
    });
  }

  function fillSettings() {
    if (!st.u.langSel) return;
    st.u.langSel.value = st.c.language;
    st.u.wEn.checked = !!st.c.webdav.enabled;
    st.u.wUrl.value = st.c.webdav.baseUrl || "";
    st.u.wUser.value = st.c.webdav.username || "";
    st.u.wPass.value = st.c.webdav.password || "";
    if (st.u.aiUrl) st.u.aiUrl.value = st.c.ai.apiUrl || "";
    if (st.u.aiKey) st.u.aiKey.value = st.c.ai.apiKey || "";
    if (st.u.aiModel) st.u.aiModel.value = st.c.ai.model || "";
    if (st.u.aiTemp) st.u.aiTemp.value = String(st.c.ai.temperature ?? 0.7);
    if (st.u.aiTempVal) st.u.aiTempVal.textContent = String(st.c.ai.temperature ?? 0.7);
    if (st.u.aiStyle) st.u.aiStyle.value = st.c.ai.style || "";
    if (st.u.aiPrompt) st.u.aiPrompt.value = st.c.ai.prompt || "";
  }

  function rows(list, mode) {
    return list.map(it=>{
      const name=it.__t==="repo" ? `${it.owner}/${it.repo}` : it.username;
      const ago=Math.max(0,Date.now()-ts(it.lastVisitedAt)), days=Math.floor(ago/86400000);
      const relative=!ts(it.lastVisitedAt)?t("ut"):ago<60000?tr("刚刚","Just now"):ago<3600000?tr(`${Math.floor(ago/60000)} 分钟前`,`${Math.floor(ago/60000)}m ago`):ago<86400000?tr(`${Math.floor(ago/3600000)} 小时前`,`${Math.floor(ago/3600000)}h ago`):tr(`${days} 天前`,`${days}d ago`);
      return `<article class="gt-record"><a class="gt-record-link" href="${e(it.url)}"><span class="gt-record-icon" aria-hidden="true">${it.__t==="repo"?SVG.g:SVG.i}</span><span class="gt-record-info"><span class="gt-record-name">${e(name)}</span><span class="gt-meta"><time datetime="${e(it.lastVisitedAt)}" title="${e(fmt(it.lastVisitedAt))}">${e(relative)}</time><span>· ${it.visitCount} ${e(tr("次访问","visits"))}</span>${mode==="merged"?`<span class="Label">${e(t(it.__t==="repo"?"tr":"tu"))}</span>`:""}</span></span></a><div class="gt-record-actions"><button data-pin data-type="${it.__t}" data-key="${e(it.key)}" aria-pressed="${!!it.pinned}" aria-label="${e(tr(it.pinned?"取消收藏":"收藏",it.pinned?"Unfavorite":"Favorite")+" "+name)}" title="${e(tr("收藏","Favorite"))}" ${st.u.syncing?"disabled":""}>${it.pinned?"★":"☆"}</button><button data-delete data-type="${it.__t}" data-key="${e(it.key)}" aria-label="${e(tr("删除","Delete")+" "+name)}" title="${e(tr("删除","Delete"))}" ${st.u.syncing?"disabled":""}>×</button></div></article>`;
    }).join("");
  }

  async function setMode(mode) {
    if (mode!=="split" && mode!=="merged") return;
    const next=structuredClone(st.c); next.ui.listMode=mode;
    try {await setV(CFG_KEY,next);st.c=next;st.u.limit=30;renderHistory();st.u.body.querySelector(mode==="split"?"#gt-ms":"#gt-mm")?.focus();}
    catch(err){status(err.message,"error");}
  }

  async function saveSettings(silent) {
    if (!st.u.langSel) return;
    const next=structuredClone(st.c);
    next.language=st.u.langSel.value==="en"?"en":"zh-CN";
    next.ui.theme=st.u.body.querySelector("#gt-theme").value;
    next.recordingPaused=st.u.body.querySelector("#gt-paused").checked;
    next.webdav={enabled:st.u.wEn.checked,baseUrl:st.u.wUrl.value.trim(),username:st.u.wUser.value.trim(),password:st.u.wPass.value,fileName:FILE};
    next.ai={apiUrl:st.u.aiUrl.value.trim(),apiKey:st.u.aiKey.value.trim(),model:st.u.aiModel.value.trim() || "gpt-4o-mini",temperature:clampTemp(st.u.aiTemp.value),style:st.u.aiStyle.value.trim() || defaultAiStyle(next.language),prompt:st.u.aiPrompt.value.trim() || defaultAiPrompt(next.language)};
    try {
      if (next.webdav.enabled) buildUrl(next.webdav.baseUrl,FILE);
      if (next.ai.apiUrl && !isValidAiApiUrl(next.ai.apiUrl)) throw new Error(t("ai_url_invalid"));
      await setV(CFG_KEY,next);
      st.c=next; st.u.settingsDraft=null; clearAiIssue(); applyTheme(); ensureTopbar(); renderSidebar();
      if (!silent) status(t("sv"),"info",3000);
    } catch(err) {status(err.message,"error");st.u.body.scrollTop=0;}
  }

  function exportHistory() {
    const json = JSON.stringify(st.d, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `github-history-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function importHistory() {
    const input = st.u.importInput;
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      if (Number(file.size || 0) > IMPORT_MAX_BYTES) {
        throw new Error(t("il", { size: formatBytes(IMPORT_MAX_BYTES) }));
      }
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = validateHistory(parsed);
      const count = Object.keys(imported.repo || {}).length + Object.keys(imported.user || {}).length;
      await mutateData(latest => merge(latest, imported));
      if (st.u.view === "history") renderHistory();
      status(t("io", { count }), "info", 2200);
    } catch (err) {
      status(t("if", { msg: err.message }), "error");
    } finally {
      input.value = "";
    }
  }

  function openAnalysisView() {
    st.u.aiError = "";
    switchView("analysis");
  }

  async function runAiAnalysisInitial() {
    if (st.u.aiLoading) return;
    if (!Object.keys(st.d.repo).length && !Object.keys(st.d.user).length) {
      st.u.aiError = aiText("先浏览一些仓库或用户主页，再开始分析。", "Visit a repository or profile before starting an analysis.");
      if (st.u.view === "analysis") renderAnalysis();
      return;
    }
    st.u.aiLoading = true;
    st.u.aiError = "";
    if (st.u.view === "analysis") renderAnalysis();
    try {
      const messages = buildInitialAiMessages();
      const result = await requestAiChat(messages);
      const now = new Date().toISOString();
      const session = {
        id: makeSessionId(),
        title: makeAiSessionTitle(result),
        createdAt: now,
        updatedAt: now,
        messages: [...messages, { role: "assistant", content: result }],
      };
      await appendAiSession(session);
      st.u.activeAiSessionId = session.id;
      st.u.aiResult = result;
      st.u.aiDraft = "";
    } catch (err) {
      st.u.aiError = err.message || "AI request failed.";
      st.u.aiResult = "";
    } finally {
      st.u.aiLoading = false;
      if (st.u.view === "analysis") renderAnalysis();
    }
  }

  async function runAiFollowup() {
    if (st.u.aiLoading) return;
    const inputNode = st.u.aiFollowupInput;
    const question = String((inputNode && inputNode.value) || "").trim();
    if (!question) return;
    st.u.aiDraft = question;
    const session = getActiveAiSession();
    if (!session) {
      status(t("ai_need_initial"), "error", 1800);
      return;
    }

    st.u.aiLoading = true;
    st.u.aiError = "";
    if (st.u.view === "analysis") renderAnalysis();
    try {
      const messages = session.messages.map((x) => ({ role: x.role, content: x.content }));
      messages.push({ role: "user", content: question });
      const answer = await requestAiChat(messages);
      session.messages.push({ role: "user", content: question });
      session.messages.push({ role: "assistant", content: answer });
      session.updatedAt = new Date().toISOString();
      if (!session.title) session.title = makeAiSessionTitle(answer);
      touchAiSession(session.id);
      await saveAiHistory();
      st.u.aiResult = answer;
      st.u.aiDraft = "";
      if (inputNode) inputNode.value = "";
    } catch (err) {
      st.u.aiError = err.message || "AI request failed.";
    } finally {
      st.u.aiLoading = false;
      if (st.u.view === "analysis") {
        renderAnalysis();
        if (st.u.aiFollowupInput) {
          st.u.aiFollowupInput.value = st.u.aiDraft || "";
        }
      }
    }
  }

  async function requestAiChat(messages) {
    const apiUrl = String(st.c.ai.apiUrl || "").trim();
    const apiKey = String(st.c.ai.apiKey || "").trim();
    if (apiUrl && !isValidAiApiUrl(apiUrl)) {
      setAiIssue(t("ai_url_invalid"));
      throw new Error(t("ai_url_invalid"));
    }
    if (!apiUrl || !apiKey) {
      setAiIssue(t("ae"));
      throw new Error(t("ae"));
    }

    const safeMessages = limitAiMessages(messages, 40);
    if (!safeMessages.length) {
      setAiIssue(t("ai_parse_fail"));
      throw new Error(t("ai_parse_fail"));
    }

    const body = {
      model: st.c.ai.model || "gpt-4o-mini",
      temperature: clampTemp(st.c.ai.temperature),
      messages: safeMessages,
    };

    let res;
    try {
      res = await req({
        method: "POST",
        url: apiUrl,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        data: JSON.stringify(body),
        timeout: 90000,
      });
    } catch (err) {
      const msg = err && err.message ? String(err.message) : t("en");
      setAiIssue(msg);
      throw new Error(msg);
    }

    if (res.status < 200 || res.status >= 300) {
      const msg = res.status === 401 || res.status === 403
        ? t("ai_auth_fail")
        : t("ai_http", { code: String(res.status) });
      setAiIssue(msg);
      throw new Error(msg);
    }

    try {
      const parsed = JSON.parse(res.responseText || "{}");
      const rawContent = parsed?.choices?.[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : Array.isArray(rawContent)
        ? rawContent.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n")
        : "";
      if (!content.trim()) throw new Error(t("ai_parse_fail"));
      clearAiIssue();
      return content.trim();
    } catch (err) {
      const msg = t("ai_parse_fail");
      setAiIssue(msg);
      throw new Error(msg);
    }
  }

  function aiText(chinese, english) {
    return st.c.language === "en" ? english : chinese;
  }

  function limitAiMessages(raw, limit) {
    const messages = (Array.isArray(raw) ? raw : [])
      .filter((m) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));
    if (messages.length <= limit) return messages;
    // Preserve the instructions and original activity snapshot across long conversations.
    const contextLength = messages[0]?.role === "system" && messages[1]?.role === "user" ? 2 : 1;
    return [...messages.slice(0, contextLength), ...messages.slice(-(limit - contextLength))];
  }

  function buildInitialAiMessages() {
    const style = String(st.c.ai.style || "").trim() || defaultAiStyle(st.c.language);
    const prompt = String(st.c.ai.prompt || "").trim() || defaultAiPrompt(st.c.language);
    const historyText = buildHistorySummary();
    return [
      { role: "system", content: style },
      { role: "user", content: `${prompt}\n\n${historyText}` },
    ];
  }

  function buildHistorySummary() {
    const repo = sort(st.d.repo).slice(0, 80).map((r) => `repo: ${r.owner}/${r.repo} | visits=${r.visitCount} | last=${r.lastVisitedAt}`);
    const user = sort(st.d.user).slice(0, 80).map((u) => `user: ${u.username} | visits=${u.visitCount} | last=${u.lastVisitedAt}`);
    return ["[Repository History]", ...repo, "", "[User History]", ...user].join("\n");
  }

  function renderAiConversation(messages) {
    const list = Array.isArray(messages) ? messages.filter((x) => x && x.role !== "system") : [];
    if (!list.length) {
      return `<div class="gt-ai-box text-small color-fg-muted">${e(t("ai_empty"))}</div>`;
    }
    const items = list.map((msg, index) => {
      const role = String(msg.role || "");
      const isUser = role === "user";
      const roleLabel = isUser ? t("ai_you") : t("ai_assistant");
      let content = isUser
        ? `<p>${e(String(msg.content || "")).replace(/\n/g, "<br>")}</p>`
        : renderMarkdownSafe(msg.content);
      if (isUser && index === 0 && msg.content.includes("[Repository History]")) {
        content = `<details class="gt-ai-context"><summary>${e(aiText("本次分析使用的浏览记录", "Activity shared for this analysis"))}</summary>${content}</details>`;
      }
      return `<div class="gt-chat-msg ${isUser ? "is-user" : ""}">
        <div class="gt-chat-role">${e(roleLabel)}</div>
        <div class="gt-chat-content">${content}</div>
      </div>`;
    }).join("");
    return `<div class="gt-chat-list">${items}</div>`;
  }

  function renderMarkdownSafe(input) {
    const source = String(input || "").replace(/\r\n?/g, "\n");
    const escaped = e(source);
    let codePrefix = "@@GT_CODE_";
    while (source.includes(codePrefix)) codePrefix = `_${codePrefix}`;
    const codePattern = new RegExp(`${codePrefix}(\\d+)@@`, "g");
    const codeLinePattern = new RegExp(`^${codePrefix}\\d+@@$`);
    const codeBlocks = [];
    const withCodeToken = escaped.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      const langClass = sanitizeLang(lang);
      const cls = langClass ? ` class="language-${langClass}"` : "";
      codeBlocks.push(`<pre><code${cls}>${code}</code></pre>`);
      return `${codePrefix}${idx}@@`;
    });

    const lines = withCodeToken.split("\n");
    let html = "";
    let inUl = false;
    let inOl = false;
    let inP = false;

    const closeLists = () => {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
    };
    const closeP = () => {
      if (inP) {
        html += "</p>";
        inP = false;
      }
    };

    for (const lineRaw of lines) {
      const line = String(lineRaw || "");
      const trimLine = line.trim();
      if (!trimLine) {
        closeP();
        closeLists();
        continue;
      }
      if (codeLinePattern.test(trimLine)) {
        closeP();
        closeLists();
        html += trimLine;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        closeP();
        closeLists();
        const level = heading[1].length;
        html += `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`;
        continue;
      }

      const ul = line.match(/^\s*[-*]\s+(.+)$/);
      if (ul) {
        closeP();
        if (inOl) {
          html += "</ol>";
          inOl = false;
        }
        if (!inUl) {
          html += "<ul>";
          inUl = true;
        }
        html += `<li>${renderInlineMarkdown(ul[1])}</li>`;
        continue;
      }

      const ol = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ol) {
        closeP();
        if (inUl) {
          html += "</ul>";
          inUl = false;
        }
        if (!inOl) {
          html += "<ol>";
          inOl = true;
        }
        html += `<li>${renderInlineMarkdown(ol[1])}</li>`;
        continue;
      }

      closeLists();
      if (!inP) {
        html += "<p>";
        inP = true;
      } else {
        html += "<br>";
      }
      html += renderInlineMarkdown(line);
    }
    closeP();
    closeLists();

    const merged = html.replace(codePattern, (_, idx) => codeBlocks[Number(idx)] || "");
    return sanitizeHtml(merged || `<p>${e(t("ai_empty"))}</p>`);
  }

  function renderInlineMarkdown(text) {
    const safeText = String(text || "");
    let prefix = "@@GT_INLINE_";
    while (safeText.includes(prefix)) prefix = `_${prefix}`;
    const fragments = [];
    const protect = (html) => {
      const index = fragments.push(html) - 1;
      return `${prefix}${index}@@`;
    };
    let out = safeText.replace(/`([^`]+)`/g, (_, code) => {
      return protect(`<code>${code}</code>`);
    });
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, hrefRaw) => {
      const href = normalizeSafeHref(hrefRaw);
      if (!href) return label;
      return `${protect(`<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`)}${label}${protect("</a>")}`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(new RegExp(`${prefix}(\\d+)@@`, "g"), (_, idx) => fragments[Number(idx)] || "");
    return out;
  }

  function sanitizeHtml(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");
    const allowTags = new Set(["P", "BR", "STRONG", "EM", "CODE", "PRE", "A", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6"]);
    const elements = Array.from(tpl.content.querySelectorAll("*"));
    for (const el of elements) {
      if (!allowTags.has(el.tagName)) {
        el.replaceWith(document.createTextNode(el.textContent || ""));
        continue;
      }
      const allowAttr = el.tagName === "A"
        ? new Set(["href", "target", "rel"])
        : el.tagName === "CODE"
          ? new Set(["class"])
          : new Set();
      for (const attr of Array.from(el.attributes)) {
        if (!allowAttr.has(attr.name)) el.removeAttribute(attr.name);
      }
      if (el.tagName === "A") {
        const href = normalizeSafeHref(el.getAttribute("href"));
        if (!href) {
          el.removeAttribute("href");
          el.removeAttribute("target");
          el.removeAttribute("rel");
        } else {
          el.setAttribute("href", href);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer nofollow");
        }
      }
      if (el.tagName === "CODE") {
        const cls = String(el.getAttribute("class") || "");
        if (cls && !/^language-[a-z0-9_-]{1,24}$/i.test(cls)) {
          el.removeAttribute("class");
        }
      }
    }
    return tpl.innerHTML;
  }

  function normalizeSafeHref(input) {
    const raw = String(input || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .trim();
    if (!raw) return "";
    try {
      const u = new URL(raw, window.location.origin);
      if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "mailto:") return "";
      return u.href;
    } catch (_error) {
      return "";
    }
  }

  function escapeAttr(input) {
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sanitizeLang(input) {
    const value = String(input || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return value.slice(0, 24);
  }

  function formatBytes(bytes) {
    const mb = Math.round((Number(bytes || 0) / (1024 * 1024)) * 10) / 10;
    return `${mb}MB`;
  }

  function defAiHistory() {
    return {
      version: 1,
      sessions: [],
    };
  }

  function normalizeAiHistory(raw) {
    const out = defAiHistory();
    if (!raw || typeof raw !== "object") return out;
    const list = Array.isArray(raw.sessions) ? raw.sessions : [];
    const seen = new Set();
    out.sessions = list.map((item, index) => normalizeAiSession(item, index))
      .filter(Boolean)
      .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
      .filter((session) => {
        if (seen.has(session.id)) return false;
        seen.add(session.id);
        return true;
      })
      .slice(0, AI_HISTORY_MAX_SESSIONS);
    return out;
  }

  function normalizeAiSession(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const now = new Date().toISOString();
    const id = String(raw.id || makeSessionId(index));
    const messagesRaw = Array.isArray(raw.messages) ? raw.messages : [];
    const messages = limitAiMessages(messagesRaw, 200);
    if (!messages.length) return null;
    return {
      id,
      title: String(raw.title || "").trim().slice(0, 160),
      createdAt: ts(raw.createdAt) ? new Date(raw.createdAt).toISOString() : now,
      updatedAt: ts(raw.updatedAt) ? new Date(raw.updatedAt).toISOString() : now,
      messages,
    };
  }

  async function saveAiHistory() {
    try {
      st.ah = normalizeAiHistory(st.ah);
      await setV(AI_HISTORY_KEY, st.ah);
      return true;
    } catch (_error) {
      st.u.aiError = aiText("分析结果仍在当前页面，但保存失败。请检查浏览器存储空间后重试。", "The result is available on this page, but could not be saved. Check browser storage and try again.");
      return false;
    }
  }

  function makeSessionId(seed) {
    const suffix = typeof seed === "number" ? String(seed) : Math.random().toString(36).slice(2, 8);
    return `ai_${Date.now()}_${suffix}`;
  }

  function makeAiSessionTitle(content) {
    const first = String(content || "").trim().split("\n").find((x) => x.trim()) || t("ai_result");
    return first.replace(/^#+\s*/, "").slice(0, 72);
  }

  function getActiveAiSession() {
    if (!st.ah || !Array.isArray(st.ah.sessions) || st.ah.sessions.length === 0) return null;
    const found = st.ah.sessions.find((x) => x.id === st.u.activeAiSessionId);
    if (found) return found;
    st.u.activeAiSessionId = st.ah.sessions[0].id;
    return st.ah.sessions[0];
  }

  async function appendAiSession(session) {
    const normalized = normalizeAiSession(session, 0);
    if (!normalized) return;
    const next = st.ah.sessions.filter((x) => x.id !== normalized.id);
    next.unshift(normalized);
    st.ah.sessions = next.slice(0, AI_HISTORY_MAX_SESSIONS);
    return await saveAiHistory();
  }

  function touchAiSession(sessionId) {
    const idx = st.ah.sessions.findIndex((x) => x.id === sessionId);
    if (idx <= 0) return;
    const item = st.ah.sessions[idx];
    st.ah.sessions.splice(idx, 1);
    st.ah.sessions.unshift(item);
  }

  function loadAiSession(sessionId) {
    if (st.u.aiLoading) return false;
    const found = st.ah.sessions.find((x) => x.id === sessionId);
    if (!found) return false;
    st.u.activeAiSessionId = found.id;
    st.u.aiResult = "";
    st.u.aiError = "";
    st.u.aiDraft = "";
    if (st.u.view === "analysis") {
      renderAnalysis();
    } else {
      switchView("analysis");
    }
    return true;
  }

  async function clearAll() {
    if (st.u.syncing) return status(t("sy"), "info");
    if (!window.confirm(t("cc"))) return;
    await mutateData(() => defData());
    st.u.deleted = null;
    status(t("cl"), "info", 1800);
    if (st.u.view === "settings") renderSettings();
    else if (st.u.view === "history") renderHistory();
    else renderSidebar();
  }

  function setAiIssue(msg) {
    st.u.aiIssue = String(msg || "").trim();
    if (st.u.view === "history") renderHistory();
  }

  function clearAiIssue() {
    if (!st.u.aiIssue) return;
    st.u.aiIssue = "";
    if (st.u.view === "history") renderHistory();
  }

  function status(msg, type, ttl) {
    if (st.u.statusTimer) {
      clearTimeout(st.u.statusTimer);
      st.u.statusTimer = null;
    }
    st.u.status = msg;
    st.u.statusType = type || "info";
    paintStatus();
    if (ttl && Number(ttl) > 0) {
      st.u.statusTimer = setTimeout(() => {
        st.u.status = "";
        paintStatus();
        st.u.statusTimer = null;
      }, Number(ttl));
    }
  }

  function paintStatus() {
    if (!st.u.statusNode) return;
    if (!st.u.status) {
      st.u.statusNode.textContent = "";
      st.u.statusNode.style.display = "none";
      return;
    }
    st.u.statusNode.style.display = "block";
    st.u.statusNode.textContent = st.u.status;
    st.u.statusNode.classList.remove("info", "error");
    st.u.statusNode.classList.add(st.u.statusType || "info");
  }

  function syncBtnState(syncing) {
    st.u.body?.querySelectorAll("[data-delete],[data-pin],#gt-undo,#gt-clear-settings").forEach(button => { button.disabled=syncing; });
    if (!st.u.syncBtn) return;
    st.u.syncBtn.disabled = syncing;
    st.u.syncBtn.textContent = syncing ? t("sy") : t("sn");
  }

  async function syncNow() {
    if (st.u.syncing) return;
    if (!st.c.webdav.enabled) return status(t("ew"), "error");
    if (!st.c.webdav.baseUrl) return status(t("eb"), "error");

    try {
      st.u.syncing = true;
      syncBtnState(true);
      status(t("sy"), "info");
      const merged = await syncWebDav(async () => normData(await getV(DATA_KEY, defData())), { ...st.c.webdav });
      await mutateData(latest => merge(latest, merged));
      if (st.u.view === "history") renderHistory();
      status(t("ok", { time: fmt(new Date().toISOString()) }), "info", 2200);
    } catch (err) {
      status(t("sf", { msg: err.message }), "error");
    } finally {
      st.u.syncing = false;
      syncBtnState(false);
    }
  }

  async function record() {
    const pathname = normPath(window.location.pathname);
    // Turbo may render the same URL several times, well after a short debounce.
    if (st.last.p === pathname) return;
    st.last.p = pathname;
    st.last.t = Date.now();
    if (st.c.recordingPaused) return;
    const r = parseRoute(pathname);
    if (!r) return;
    const iso = new Date().toISOString();
    try {
      await mutateData(latest => {
        const map = latest[r.type];
        const old = Object.hasOwn(map, r.key) ? map[r.key] : undefined;
        map[r.key] = {
          ...(old || {}), key: r.key, url: r.url, lastVisitedAt: iso,
          visitCount: Math.min(Number.MAX_SAFE_INTEGER, (old ? old.visitCount : 0) + 1),
          ...(r.type === "repo" ? { owner: r.owner, repo: r.repo } : { username: r.username })
        };
        prune(map, maxItems());
      });
    } catch (error) {
      if (st.last.p === pathname) st.last.p = "";
      throw error;
    }
  }

  function parseRoute(raw) {
    if (window.location.hostname !== "github.com") return null;
    const p = normPath(raw);
    if (p === "/" || excluded(p.toLowerCase())) return null;
    const parts = p.split("/").filter(Boolean);
    const owner = parts[0];
    if (!safeOwner(owner) || RESERVED.has(owner.toLowerCase())) return null;
    if (parts.length === 1) {
      return { type: "user", key: owner.toLowerCase(), username: owner, url: `https://github.com/${owner}`, pathname: p };
    }
    const repo = parts[1];
    if (!safeSeg(repo)) return null;
    return { type: "repo", key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, owner, repo,
      url: `https://github.com/${owner}/${repo}`, pathname: p };
  }

  function excluded(p) {
    return exPrefixes().some((x) => p === x || p.startsWith(`${x}/`));
  }

  function safeSeg(s) {
    return typeof s === "string" && /^[A-Za-z0-9._-]+$/.test(s) && s !== "." && s !== "..";
  }

  function safeOwner(s) {
    return typeof s === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(s) && safeSeg(s);
  }

  function normPath(p) {
    const n = String(p || "/").replace(/\/{2,}/g, "/");
    return n.length > 1 && n.endsWith("/") ? n.slice(0, -1) : n;
  }

  async function syncWebDav(local, cfg) {
    const url = buildUrl(cfg.baseUrl, cfg.fileName);
    const headers = { Accept: "application/json" };
    if (cfg.username) headers.Authorization = `Basic ${b64(`${cfg.username}:${cfg.password || ""}`)}`;
    let remote = defData();
    const response = await req({ method: "GET", url, headers });
    if (response.status >= 200 && response.status < 300) {
      const text = response.responseText || "";
      if (new Blob([text]).size > IMPORT_MAX_BYTES) throw new Error(t("il", { size: formatBytes(IMPORT_MAX_BYTES) }));
      if (!text.trim()) throw new Error(t("ej"));
      let parsed;
      try { parsed = JSON.parse(text); } catch (_error) { throw new Error(t("ej")); }
      remote = validateHistory(parsed);
    } else if (response.status !== 404) {
      throw new Error(t("eg", { code: String(response.status) }));
    }
    // Read current local records after GET so navigation during the request is retained.
    const merged = merge(typeof local === "function" ? await local() : local, remote);
    const etag = String(response.responseHeaders || "").match(/^etag:\s*(.+)$/im)?.[1]?.trim();
    const condition = response.status === 404 ? { "If-None-Match": "*" } : etag && !etag.startsWith("W/") ? { "If-Match": etag } : {};
    const result = await req({ method: "PUT", url,
      headers: { ...headers, ...condition, "Content-Type": "application/json; charset=utf-8" },
      data: JSON.stringify(merged, null, 2)
    });
    if (result.status === 409 || result.status === 412) throw new Error(st.c.language === "en" ? "Remote data changed. Sync again to merge the latest records." : "远端记录已被其他设备更新，请重新同步以合并最新记录。");
    if (result.status < 200 || result.status >= 300) throw new Error(t("ep", { code: String(result.status) }));
    return merged;
  }

  function merge(aRaw, bRaw) {
    const a = normData(aRaw), b = normData(bRaw), out = defData();
    out.repo = mergeMap(a.repo, b.repo);
    out.user = mergeMap(a.user, b.user);
    prune(out.repo, maxItems());
    prune(out.user, maxItems());
    out.meta.updatedAt = new Date().toISOString();
    return out;
  }

  function mergeMap(x, y) {
    const out = {}, keys = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
    for (const key of keys) {
      const a = Object.hasOwn(x || {}, key) ? cleanRec(x[key], key) : null;
      const b = Object.hasOwn(y || {}, key) ? cleanRec(y[key], key) : null;
      if (!a && !b) continue;
      const win = !b || (a && ts(a.lastVisitedAt) >= ts(b.lastVisitedAt)) ? a : b;
      out[win.key] = { ...win, visitCount: Math.max(a?.visitCount || 1, b?.visitCount || 1) };
    }
    return out;
  }

  function cleanRec(r, k, type) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    const parts = String(k || "").split("/");
    type = type || (parts.length === 2 ? "repo" : "user");
    const owner = String(type === "repo" ? (r.owner || parts[0] || "") : (r.username || parts[0] || ""));
    const repo = String(r.repo || parts[1] || "");
    if (!safeOwner(owner) || RESERVED.has(owner.toLowerCase()) || (type === "repo" && !safeSeg(repo))) return null;
    const key = type === "repo" ? `${owner.toLowerCase()}/${repo.toLowerCase()}` : owner.toLowerCase();
    const count = Number(r.visitCount);
    const date = ts(r.lastVisitedAt);
    return {
      key, ...(type === "repo" ? { owner, repo } : { username: owner }),
      url: `https://github.com/${owner}${type === "repo" ? `/${repo}` : ""}`,
      lastVisitedAt: date > 0 ? new Date(date).toISOString() : "",
      visitCount: Number.isFinite(count) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(count))) : 1,
      pinned: r.pinned === true
    };
  }

  function prune(map, m) {
    const es = Object.entries(map || {});
    if (es.length <= m) return;
    es.sort((a, b) => ts(b[1].lastVisitedAt) - ts(a[1].lastVisitedAt));
    const keep = es.slice(0, m), next = {};
    for (const [k, v] of keep) next[k] = v;
    for (const k of Object.keys(map)) delete map[k];
    Object.assign(map, next);
  }

  function sort(map) {
    return Object.values(map || {}).sort((a, b) => ts(b.lastVisitedAt) - ts(a.lastVisitedAt));
  }

  function ts(v) {
    const n = new Date(v || 0).getTime();
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(iso) {
    const n = ts(iso);
    return n ? new Date(n).toLocaleString() : t("ut");
  }

  function buildUrl(baseRaw, fileRaw) {
    const file = String(fileRaw || FILE).trim();
    const base = new URL(String(baseRaw || "").trim());
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || !safeSeg(file)) {
      throw new Error(st.c.language === "en" ? "Use an HTTPS WebDAV URL without credentials, query, or fragment." : "请使用 HTTPS WebDAV 地址，且不要在地址中包含账号、查询参数或片段。");
    }
    if (base.pathname.split("/").pop() !== file) base.pathname = `${base.pathname.replace(/\/$/, "")}/${file}`;
    return base.href;
  }

  function b64(s) {
    return btoa(unescape(encodeURIComponent(s)));
  }

  function req(o) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: o.method, url: o.url, headers: o.headers || {}, data: o.data,
        timeout: o.timeout || 60000, anonymous: true,
        onload: (r) => {
          if (r.finalUrl && new URL(r.finalUrl).origin !== new URL(o.url).origin) {
            reject(new Error(st.c.language === "en" ? "Cross-origin redirect rejected." : "请求被重定向到其他站点，请填写最终服务地址。"));
          } else resolve(r);
        },
        onerror: () => reject(new Error(t("en"))),
        ontimeout: () => reject(new Error(t("et"))),
        onabort: () => reject(new Error(t("en")))
      });
    });
  }

  async function mutateData(mutator) {
    const commit = async () => {
      // Every tab reads the latest stored version inside the same origin-wide lock.
      const draft = normData(await getV(DATA_KEY, defData()));
      const replacement = mutator(draft);
      const next = normData(replacement === undefined ? draft : replacement);
      next.meta.updatedAt = new Date().toISOString();
      await setV(DATA_KEY, next);
      st.d = next;
      return next;
    };
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      return navigator.locks.request(DATA_KEY, commit);
    }
    // Older browsers still serialize concurrent operations within this tab.
    const previous = mutateData.queue || Promise.resolve();
    const operation = previous.catch(() => {}).then(commit);
    mutateData.queue = operation.catch(() => {});
    return operation;
  }

  function watchData() {
    if (st.u.dataListener !== undefined || typeof GM_addValueChangeListener !== "function") return;
    st.u.dataListener = GM_addValueChangeListener(DATA_KEY, (_key, _old, value, remote) => {
      if (remote) st.d = normData(value);
      // Do not replace a focused search field. Opening or filtering renders fresh data.
    });
  }

  async function getV(k, fb) {
    try {
      return await GM_getValue(k, fb);
    } catch (_error) {
      st.u.loadFailed = true;
      throw new Error("GitHub Trail: 无法读取本地数据 / Cannot read local storage.");
    }
  }

  async function setV(k, v) {
    if (st.u.loadFailed) {
      const message = st.c.language === "en" ? "Local data could not be loaded. Reload this page before saving to protect existing records." : "本地数据读取失败，为保护已有记录已停止写入。请修复存储权限后刷新页面。";
      status(message, "error");
      throw new Error(message);
    }
    // Snapshot before awaiting: later mutations must not alter a queued write.
    const snapshot = JSON.parse(JSON.stringify(v));
    const queues = setV.queues || (setV.queues = new Map());
    const previous = queues.get(k) || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => GM_setValue(k, snapshot));
    queues.set(k, operation);
    try {
      await operation;
    } catch (_error) {
      const message = st.c.language === "en" ? "Could not save locally. Check userscript storage permissions or available space." : "本地保存失败，请检查油猴存储权限或可用空间。";
      status(message, "error");
      throw new Error(message);
    } finally {
      if (queues.get(k) === operation) queues.delete(k);
    }
  }

  function isP(v) { return !!v && typeof v.then === "function"; }

  function defData() {
    return { version: 1, repo: {}, user: {}, meta: { updatedAt: "" } };
  }

  function defCfg() {
    return {
      language: "zh-CN",
      maxItemsPerType: MAX,
      excludedPrefixes: [...EX],
      recordingPaused: false,
      ui: { listMode: "merged", theme: "auto" },
      webdav: { enabled: false, baseUrl: "", username: "", password: "", fileName: FILE },
      ai: {
        apiUrl: "https://api.openai.com/v1/chat/completions",
        apiKey: "",
        model: "gpt-4o-mini",
        temperature: 0.7,
        style: defaultAiStyle("zh-CN"),
        prompt: defaultAiPrompt("zh-CN"),
      }
    };
  }

  function normData(raw) {
    const d = raw && typeof raw === "object" ? raw : {};
    const out = defData();
    out.version = 1;
    out.repo = normMap(d.repo, "repo");
    out.user = normMap(d.user, "user");
    out.meta.updatedAt = d.meta && typeof d.meta.updatedAt === "string" ? d.meta.updatedAt : "";
    prune(out.repo, MAX);
    prune(out.user, MAX);
    return out;
  }

  function normMap(raw, type) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key, value] of Object.entries(raw)) {
      const item = cleanRec(value, key, type);
      if (!item) continue;
      const previous = Object.hasOwn(out, item.key) ? out[item.key] : undefined;
      if (!previous) out[item.key] = item;
      else {
        const winner = ts(previous.lastVisitedAt) >= ts(item.lastVisitedAt) ? previous : item;
        out[item.key] = { ...winner, visitCount: Math.max(previous.visitCount, item.visitCount) };
      }
    }
    return out;
  }

  function validateHistory(raw) {
    const isMap = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    if (!isMap(raw) || (!Object.hasOwn(raw, "repo") && !Object.hasOwn(raw, "user")) ||
        (raw.version !== undefined && raw.version !== 1)) throw new Error(t("iu"));
    for (const type of ["repo", "user"]) {
      if (!Object.hasOwn(raw, type)) continue;
      if (!isMap(raw[type])) throw new Error(t("iu"));
      for (const [key, value] of Object.entries(raw[type])) {
        if (!cleanRec(value, key, type)) throw new Error(t("iu"));
      }
    }
    return normData(raw);
  }

  function normCfg(raw) {
    const out = defCfg();
    if (!raw || typeof raw !== "object") return out;
    out.language = raw.language === "en" ? "en" : "zh-CN";
    out.maxItemsPerType = Math.min(MAX, Math.max(1, Math.floor(Number(raw.maxItemsPerType)) || MAX));
    out.recordingPaused = raw.recordingPaused === true;
    out.excludedPrefixes = Array.isArray(raw.excludedPrefixes) ? raw.excludedPrefixes.filter((x) => typeof x === "string") : [...EX];
    out.ui.listMode = raw.ui && raw.ui.listMode === "split" ? "split" : "merged";
    out.ui.theme = ["light", "dark"].includes(raw.ui?.theme) ? raw.ui.theme : "auto";
    const w = raw.webdav && typeof raw.webdav === "object" ? raw.webdav : {};
    out.webdav.enabled = !!w.enabled;
    out.webdav.baseUrl = String(w.baseUrl || "");
    out.webdav.username = String(w.username || "");
    out.webdav.password = String(w.password || "");
    out.webdav.fileName = FILE;
    const a = raw.ai && typeof raw.ai === "object" ? raw.ai : {};
    out.ai.apiUrl = String(a.apiUrl || out.ai.apiUrl || "");
    out.ai.apiKey = String(a.apiKey || "");
    out.ai.model = String(a.model || out.ai.model || "gpt-4o-mini");
    out.ai.temperature = clampTemp(a.temperature);
    const style = String(a.style || "").trim();
    const prompt = String(a.prompt || "").trim();
    out.ai.style = style || defaultAiStyle(out.language);
    out.ai.prompt = prompt || defaultAiPrompt(out.language);
    return out;
  }

  function maxItems() {
    const n = Number(st.c.maxItemsPerType || MAX);
    return Number.isFinite(n) && n > 0 ? Math.min(MAX, Math.floor(n)) : MAX;
  }

  function clampTemp(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.7;
    if (n < 0) return 0;
    if (n > 2) return 2;
    return Math.round(n * 10) / 10;
  }

  function defaultAiStyle(language) {
    if (language === "en") {
      return "You are a practical GitHub activity analyst. Respond in concise Markdown with sections: Patterns, Interests, Risks, Next Actions. Keep advice actionable and avoid filler.";
    }
    return "你是一个务实的 GitHub 访问行为分析助手。请用简洁 Markdown 输出，固定包含：访问模式、兴趣方向、潜在风险、下一步建议。建议要可执行，不要空话。";
  }

  function defaultAiPrompt(language) {
    if (language === "en") {
      return "Analyze my GitHub visit history. Infer my technical interests and likely goals, then propose concrete next actions with priorities.";
    }
    return "请分析我的 GitHub 访问历史，推断我的技术兴趣与可能目标，并给出带优先级的具体行动建议。";
  }

  function isValidAiApiUrl(url) {
    try {
      const u = new URL(String(url || "").trim());
      return u.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function exPrefixes() {
    const p = st.c.excludedPrefixes;
    return Array.isArray(p) && p.length ? p : EX;
  }

  function t(k, p) {
    const dict = st.c.language === "en" ? I18N.en : I18N["zh-CN"];
    let txt = dict[k] || I18N["zh-CN"][k] || k;
    if (p) for (const [x, y] of Object.entries(p)) txt = txt.replace(new RegExp(`{{${x}}}`, "g"), String(y));
    return txt;
  }

  function e(input) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(input).replace(/[&<>"']/g, (m) => map[m]);
  }

  function clearStatus() {
    if (st.u.statusTimer) {
      clearTimeout(st.u.statusTimer);
      st.u.statusTimer = null;
    }
    st.u.status = "";
    paintStatus();
  }

  function triggerViewAnimation(direction = 1) {
    st.u.viewAnimation?.cancel();
    st.u.viewAnimation = null;
    if (!st.u.open || st.u.motionQuery.matches || typeof st.u.body.animate !== "function") return;
    // Only animate view navigation, never search/input-driven list updates.
    const animation = st.u.body.animate([
      { opacity: 0, transform: `translateX(${direction * 12}px)` },
      { opacity: 1, transform: "translateX(0)" }
    ], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
    st.u.viewAnimation = animation;
    animation.finished.then(() => {
      if (st.u.viewAnimation === animation) st.u.viewAnimation = null;
    }).catch(() => {}); // Cancellation is expected when navigating or closing quickly.
  }

  function switchView(nextView) {
    if (!st.u.mounted || !st.u.open || st.u.view === nextView) return;
    clearStatus();
    st.u.view = nextView;
    renderSidebar(true, nextView === "history" ? -1 : 1);
    st.u.body.scrollTop = 0;
    (st.u.body.querySelector("#gt-search") || st.u.tbtn).focus({ preventScroll: true });
  }

  function cleanupLegacyUsers() {
    let changed = false;
    for (const [key, val] of Object.entries(st.d.user || {})) {
      const username = String((val && val.username) || key || "").toLowerCase();
      if (RESERVED.has(username)) {
        delete st.d.user[key];
        changed = true;
      }
    }
    if (changed) st.d.meta.updatedAt = new Date().toISOString();
    return changed;
  }
})();
