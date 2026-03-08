// ==UserScript==
// @name         GitHub Trail
// @namespace    https://github.com/
// @version      1.1.0
// @description  Record visited GitHub repositories and user profiles with local JSON + optional WebDAV sync.
// @author       GitHub Trail
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @icon         https://pic.clami.fun/file/AgACAgUAAyEGAATfaZ8ZAAMDaazl6YjrLJDZejQQV0bUsffuyYgAAqkNaxuO4GhVK0MrNze09S0BAAMCAAN5AAM6BA.png
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
    "about", "account", "actions", "blog", "collections", "contact", "copilot", "dashboard", "enterprise",
    "events", "explore", "features", "gist", "gists", "issues", "join", "login", "logout", "marketplace",
    "new", "notifications", "orgs", "organizations", "pricing", "pulls", "search", "security", "session",
    "settings", "signup", "site", "sponsors", "teams", "topics", "trending", "users"
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
      mounted: false, open: false, syncing: false, view: "history", showAll: false,
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

  void init();

  async function init() {
    st.d = normData(await getV(DATA_KEY, defData()));
    st.c = normCfg(await getV(CFG_KEY, defCfg()));
    st.ah = normalizeAiHistory(await getV(AI_HISTORY_KEY, defAiHistory()));
    cleanupLegacyUsers();
    await setV(DATA_KEY, st.d);
    await setV(CFG_KEY, st.c);
    await saveAiHistory();
    css();
    ensureSidebar();
    ensureTopbar();
    watchTopbar();
    bind();
    await route();
    setTimeout(() => void route(), 300);
  }

  function bind() {
    document.addEventListener("pjax:end", () => void route());
    document.addEventListener("turbo:render", () => void route());
    window.addEventListener("load", () => void route());
  }

  async function route() {
    ensureTopbar();
    await record();
    if (st.u.open && st.u.view === "history") renderHistory();
  }

  function css() {
    if (document.getElementById("gt-style")) return;
    const el = document.createElement("style");
    el.id = "gt-style";
    el.textContent =
` .gt-backdrop{position:fixed;inset:0;background:rgba(27,31,36,.42);z-index:80;display:none}
  .gt-backdrop{background:linear-gradient(90deg,rgba(15,23,42,.01) 0%,rgba(15,23,42,.06) 56%,rgba(15,23,42,.12) 100%)}
  .gt-backdrop.is-open{display:block}
  .gt-sidebar{position:fixed;top:0;right:0;width:min(440px,94vw);height:100vh;z-index:81;transform:translateX(100%);transition:transform .24s cubic-bezier(.16,1,.3,1);display:flex;overflow:hidden}
  .gt-sidebar::before{content:"";position:absolute;left:-24px;top:0;width:24px;height:100%;pointer-events:none;opacity:0;transition:opacity .18s ease;background:linear-gradient(to left,rgba(15,23,42,.12),rgba(15,23,42,0))}
  .gt-sidebar.is-open{transform:translateX(0);box-shadow:-10px 0 28px rgba(15,23,42,.08),-2px 0 10px rgba(15,23,42,.05)}
  .gt-sidebar.is-open::before{opacity:1}
  .gt-shell{width:100%;height:100%;display:flex;flex-direction:column;background:var(--bgColor-muted,#f6f8fa);border-left:1px solid var(--borderColor-default,#d0d7de)}
  .gt-body{flex:1;min-height:0;overflow:auto;padding:12px;background:var(--bgColor-muted,#f6f8fa);transition:opacity .2s ease,transform .2s ease}
  .gt-body.gt-view-enter{animation:gt-view-in .24s cubic-bezier(.16,1,.3,1);will-change:transform,opacity}
  @keyframes gt-view-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .gt-topbar-wrap{display:flex;align-items:center}
  .gt-fab-wrap{position:fixed;right:20px;bottom:20px;z-index:120}
  #gt-topbar-button{display:inline-flex;align-items:center;justify-content:center}
  #gt-topbar-button.gt-fab{width:42px;height:42px;border-radius:999px;border:1px solid var(--borderColor-default,#d0d7de);background:var(--bgColor-default,#fff);box-shadow:0 8px 24px rgba(15,23,42,.15),0 1px 4px rgba(15,23,42,.08);transition:transform .12s ease,box-shadow .16s ease,background-color .16s ease}
  #gt-topbar-button.gt-fab:hover{background:var(--bgColor-neutral-muted,#f6f8fa)}
  #gt-topbar-button.gt-fab:active{transform:translateY(1px) scale(.95);box-shadow:0 4px 12px rgba(15,23,42,.12),0 1px 3px rgba(15,23,42,.08)}
  #gt-topbar-button.gt-fab:focus-visible{outline:2px solid var(--fgColor-accent,#0969da);outline-offset:2px}
  #gt-topbar-button svg{width:16px;height:16px}
  .gt-head-actions{display:inline-flex;align-items:center;gap:6px}
  .gt-head-actions .Button{min-width:28px}
  .gt-brand{display:inline-flex;align-items:center;gap:6px}
  .gt-shell .Box>.Box-header{background:var(--bgColor-subtle,#eef2f7);border-bottom:1px solid var(--borderColor-default,#d0d7de)}
  .gt-tool-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .gt-tool-groups{display:grid;gap:8px;margin-bottom:10px}
  .gt-tool-group{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px;border:1px solid var(--borderColor-default,#d0d7de);border-radius:10px;background:var(--bgColor-default,#fff)}
  .gt-tool-group.ai{background:linear-gradient(180deg,#fff 0%,#f6f8fa 100%)}
  .gt-tool-group.danger{background:#fff7f7;border-color:#ffd8d3}
  .gt-tool-btn{border:1px solid var(--borderColor-default,#d0d7de);background:var(--bgColor-default,#fff);color:var(--fgColor-default,#1f2328);border-radius:8px;padding:5px 10px;font-size:12px;line-height:18px;cursor:pointer;transition:background-color .14s ease,border-color .14s ease,transform .12s ease}
  .gt-tool-btn:hover{background:var(--bgColor-neutral-muted,#f6f8fa);border-color:var(--borderColor-muted,#afb8c1)}
  .gt-tool-btn:active{transform:translateY(1px)}
  .gt-tool-btn:focus-visible{outline:2px solid var(--fgColor-accent,#0969da);outline-offset:2px}
  .gt-tool-btn.is-primary{background:var(--button-primary-bgColor-rest,#1f883d);border-color:var(--button-primary-bgColor-rest,#1f883d);color:#fff}
  .gt-tool-btn.is-primary:hover{background:var(--button-primary-bgColor-hover,#1a7f37)}
  .gt-tool-btn.is-ai{background:linear-gradient(135deg,#1f883d 0%,#2da44e 100%);border-color:#1f883d;color:#fff}
  .gt-tool-btn.is-ai:hover{background:linear-gradient(135deg,#1a7f37 0%,#238636 100%);border-color:#1a7f37}
  .gt-tool-btn.is-danger{color:var(--fgColor-danger,#cf222e)}
  .gt-tool-btn:disabled{opacity:.6;cursor:not-allowed}
  .gt-list-box{overflow:hidden;border-radius:10px}
  .gt-list-box .Box-row{padding:8px 12px;background:var(--bgColor-default,#fff);border-radius:0!important}
  .gt-list-box .Box-row:first-of-type{border-top-left-radius:0!important;border-top-right-radius:0!important}
  .gt-list-box .Box-row:last-of-type{border-bottom-left-radius:10px;border-bottom-right-radius:10px}
  .gt-list-empty{padding:10px 12px;color:var(--fgColor-muted,#59636e);font-size:12px}
  .gt-meta{display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:var(--fgColor-muted,#59636e)}
  .gt-actions-row{display:flex;gap:8px;flex-wrap:wrap}
  .gt-actions-row .Button{min-height:28px}
  .gt-status{margin-top:8px;font-size:12px}
  .gt-status.error{color:var(--fgColor-danger,#cf222e)}
  .gt-status.info{color:var(--fgColor-muted,#59636e)}
  .gt-ai-issue{margin-top:8px;padding:8px 10px;border:1px solid #ffb8bd;background:#fff1f2;border-radius:8px;font-size:12px;color:#cf222e;line-height:1.5}
  .gt-view-all-wrap{text-align:center;margin:8px 0 10px}
  .gt-view-all{border:0;background:transparent;padding:0;color:var(--fgColor-accent,#0969da);cursor:pointer;font-size:12px}
  .gt-settings-grid{display:grid;grid-template-columns:1fr;gap:8px}
  .gt-settings-grid textarea{min-height:76px;resize:vertical}
  .gt-settings-actions{display:flex;gap:8px;flex-wrap:wrap}
  .gt-settings-danger{margin-top:10px;padding:10px;border:1px solid #ffd8d3;border-radius:10px;background:#fff7f7}
  .gt-settings-danger .gt-danger-note{font-size:12px;color:#9a3412;margin-bottom:8px}
  .gt-ai-note{font-size:12px;color:var(--fgColor-muted,#59636e)}
  .gt-ai-pre{white-space:pre-wrap;word-break:break-word;line-height:1.55;margin:0}
  .gt-ai-box{background:var(--bgColor-default,#fff);border:1px solid var(--borderColor-default,#d0d7de);border-radius:10px;padding:12px}
  .gt-chat-list{display:flex;flex-direction:column;gap:10px;min-width:0;align-items:flex-start}
  .gt-chat-msg{border:1px solid var(--borderColor-default,#d0d7de);border-radius:10px;background:var(--bgColor-default,#fff);padding:10px;min-width:0;width:90%;max-width:90%;overflow:hidden}
  .gt-chat-msg.is-user{background:#f0f7ff;border-color:#b6d7ff;align-self:flex-end}
  .gt-chat-role{font-size:11px;color:var(--fgColor-muted,#59636e);margin-bottom:6px}
  .gt-chat-content{font-size:13px;line-height:1.6;color:var(--fgColor-default,#1f2328);overflow-wrap:anywhere;word-break:break-all;max-width:100%}
  .gt-chat-content *{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-break:break-all}
  .gt-chat-content p{margin:0 0 8px 0}
  .gt-chat-content p:last-child{margin-bottom:0}
  .gt-chat-content pre{padding:10px;overflow-x:auto;overflow-y:hidden;background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;max-width:100%}
  .gt-chat-content code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;overflow-wrap:anywhere;word-break:break-all}
  .gt-ai-thread-viewport{max-height:min(42vh,360px);overflow:auto;padding-right:2px;min-width:0}
  .gt-ai-followup{display:grid;gap:8px;margin-top:10px;position:relative}
  .gt-ai-followup textarea{min-height:86px;resize:vertical}
  .gt-ai-history{margin-bottom:10px;border:1px solid var(--borderColor-default,#d0d7de);border-radius:10px;background:var(--bgColor-default,#fff)}
  .gt-ai-history summary{cursor:pointer;padding:10px 12px;font-size:12px;color:var(--fgColor-muted,#59636e)}
  .gt-ai-history-list{padding:0 10px 10px 10px;display:grid;gap:8px}
  .gt-ai-history-item{border:1px solid var(--borderColor-muted,#d8dee4);border-radius:8px;padding:8px}
  .gt-ai-history-item .meta{font-size:11px;color:var(--fgColor-muted,#59636e)}
  .gt-ai-history-item button{margin-top:6px}
  .gt-about-wrap{display:grid;gap:12px}
  .gt-about-card{position:relative;overflow:hidden;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:linear-gradient(160deg,#fff 0%,#f8fafc 68%,#eef4f8 100%);box-shadow:0 10px 24px rgba(15,23,42,.06);animation:gt-about-in .28s cubic-bezier(.16,1,.3,1)}
  .gt-about-hero{display:flex;align-items:center;gap:12px}
  .gt-about-logo-wrap{flex:0 0 auto;width:86px;height:86px;border-radius:14px;background:linear-gradient(180deg,#ffffff 0%,#f7fafc 100%);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 6px 16px rgba(15,23,42,.08)}
  .gt-about-logo{width:72px;height:72px;object-fit:contain;user-select:none;-webkit-user-drag:none;animation:gt-logo-float 3.2s ease-in-out infinite}
  .gt-about-title{margin:0;font-size:18px;line-height:1.2;color:#0f172a}
  .gt-about-sub{margin:6px 0 0 0;font-size:12px;line-height:1.55;color:#475569}
  .gt-about-text{font-size:13px;line-height:1.65;color:#334155}
  .gt-about-text p{margin:0 0 8px 0}
  .gt-about-text p:last-child{margin-bottom:0}
  .gt-about-list{margin:6px 0 0 18px;padding:0}
  .gt-about-list li{margin:6px 0}
  .gt-about-version{margin-top:10px;font-size:12px;color:#64748b}
  @keyframes gt-logo-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
  @keyframes gt-about-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @media (prefers-reduced-motion: reduce){
    .gt-sidebar,.gt-body,#gt-topbar-button.gt-fab,.gt-tool-btn,.gt-about-card,.gt-about-logo{transition:none!important;animation:none!important}
  }
  .gt-inline-icon{display:inline-flex;vertical-align:middle}`;
    document.head.appendChild(el);
  }

  function ensureSidebar() {
    if (st.u.mounted) return;
    const bd = document.createElement("div");
    bd.className = "gt-backdrop";
    bd.addEventListener("click", closeSidebar);

    const sb = document.createElement("aside");
    sb.className = "gt-sidebar";
    sb.innerHTML =
`<div class="gt-shell Box color-shadow-large">
  <div class="Box-header d-flex flex-items-center flex-justify-between">
    <div class="gt-brand"><span class="gt-inline-icon">${SVG.g}</span><strong id="gt-title"></strong></div>
    <div class="gt-head-actions">
      <button id="gt-toggle" type="button" class="Button Button--invisible Button--small"></button>
      <button id="gt-about" type="button" class="Button Button--invisible Button--small"></button>
      <button id="gt-close" type="button" class="Button Button--invisible Button--small"></button>
    </div>
  </div>
  <div id="gt-body" class="gt-body"></div>
</div>`;

    document.body.appendChild(bd);
    document.body.appendChild(sb);

    st.u.bd = bd;
    st.u.sb = sb;
    st.u.title = sb.querySelector("#gt-title");
    st.u.tbtn = sb.querySelector("#gt-toggle");
    st.u.abtn = sb.querySelector("#gt-about");
    st.u.cbtn = sb.querySelector("#gt-close");
    st.u.body = sb.querySelector("#gt-body");
    st.u.mounted = true;

    st.u.tbtn?.addEventListener("click", handleToggleAction);
    st.u.abtn?.addEventListener("click", handleAboutAction);
    st.u.cbtn?.addEventListener("click", closeSidebar);
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
    const wrap = getWrap();
    const btn = getBtn();
    if (!wrap.contains(btn)) wrap.appendChild(btn);
    wrap.className = "gt-topbar-wrap gt-fab-wrap";
    btn.className = "Button Button--secondary Button--iconOnly gt-fab";
    if (!document.body.contains(wrap)) document.body.appendChild(wrap);
  }

  function watchTopbar() {
    if (st.u.obs) return;
    let lock = false;
    const o = new MutationObserver(() => {
      if (lock) return;
      lock = true;
      requestAnimationFrame(() => {
        lock = false;
        ensureTopbar();
      });
    });
    o.observe(document.documentElement, { childList: true, subtree: true });
    st.u.obs = o;
  }

  function getWrap() {
    let w = document.getElementById("gt-topbar-wrap");
    if (w) return w;
    w = document.createElement("div");
    w.id = "gt-topbar-wrap";
    w.className = "gt-topbar-wrap";
    return w;
  }

  function getBtn() {
    let b = document.getElementById("gt-topbar-button");
    if (!b) {
      b = document.createElement("button");
      b.id = "gt-topbar-button";
      b.type = "button";
      b.className = "AppHeader-button";
      b.innerHTML = SVG.h;
      b.addEventListener("click", toggleSidebar);
    }
    st.u.topBtn = b;
    const a = t("ta");
    b.title = a;
    b.setAttribute("aria-label", a);
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
    ensureSidebar();
    clearStatus();
    st.u.open = true;
    st.u.view = "history";
    st.u.showAll = false;
    st.u.sb?.classList.add("is-open");
    st.u.bd?.classList.add("is-open");
    renderSidebar();
  }

  function closeSidebar() {
    st.u.open = false;
    st.u.sb?.classList.remove("is-open");
    st.u.bd?.classList.remove("is-open");
  }

  function renderSidebar() {
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
    triggerViewAnimation();
  }

  function renderHistory() {
    const mode = st.c.ui.listMode;
    const repo = sort(st.d.repo).map((x) => ({ ...x, __t: "repo" }));
    const user = sort(st.d.user).map((x) => ({ ...x, __t: "user" }));
    const all = [...repo, ...user].sort((a, b) => ts(b.lastVisitedAt) - ts(a.lastVisitedAt));

    const limit = st.u.showAll ? Number.MAX_SAFE_INTEGER : 10;
    const rr = repo.slice(0, limit);
    const uu = user.slice(0, limit);
    const aa = all.slice(0, limit);
    const total = mode === "merged" ? all.length : repo.length + user.length;
    const hidden = mode === "merged"
      ? Math.max(all.length - aa.length, 0)
      : Math.max(repo.length - rr.length, 0) + Math.max(user.length - uu.length, 0);

    const splitCls = mode === "split" ? "Button--primary" : "";
    const mergedCls = mode === "merged" ? "Button--primary" : "";
    const body = mode === "merged"
      ? `<div class="Box gt-list-box mb-2"><div class="Box-header"><strong class="text-small">${e(t("sm"))}</strong></div>${rows(aa, "merged")}</div>`
      : `<div class="Box gt-list-box mb-2"><div class="Box-header"><strong class="text-small">${e(t("sr"))}</strong></div>${rows(rr, "repo")}</div>
         <div class="Box gt-list-box mb-2"><div class="Box-header"><strong class="text-small">${e(t("su"))}</strong></div>${rows(uu, "user")}</div>`;

    const v = total > 10
      ? `<div class="gt-view-all-wrap"><button id="gt-va" class="gt-view-all" type="button">${e(st.u.showAll ? t("vl") : t("va"))}</button></div>`
      : "";

    const syncBtnHtml = st.c.webdav.enabled
      ? `<button id="gt-sync" type="button" class="gt-tool-btn is-primary">${e(t("sn"))}</button>`
      : "";
    const aiIssueHtml = st.u.aiIssue
      ? `<div id="gt-ai-issue" class="gt-ai-issue">${e(st.u.aiIssue)}</div>`
      : "";

    st.u.body.innerHTML =
`<div class="gt-tool-groups">
  <div class="gt-tool-group data">
    ${syncBtnHtml}
    <button id="gt-export" type="button" class="gt-tool-btn">${e(t("ex"))}</button>
    <button id="gt-import" type="button" class="gt-tool-btn">${e(t("im"))}</button>
    <button id="gt-ai" type="button" class="gt-tool-btn is-ai">${e(t("ai"))}</button>
    <input id="gt-import-file" type="file" accept="application/json" style="display:none" />
  </div>
</div>
<div class="mb-2"><div class="BtnGroup">
  <button id="gt-ms" type="button" class="Button Button--small ${splitCls}">${e(t("ms"))}</button>
  <button id="gt-mm" type="button" class="Button Button--small ${mergedCls}">${e(t("mm"))}</button>
</div></div>
${body}
${hidden > 0 || (st.u.showAll && total > 10) ? v : ""}
<div id="gt-status" class="gt-status ${e(st.u.statusType)}"></div>
${aiIssueHtml}`;

    st.u.statusNode = st.u.body.querySelector("#gt-status");
    st.u.syncBtn = st.u.body.querySelector("#gt-sync");
    st.u.importInput = st.u.body.querySelector("#gt-import-file");
    paintStatus();
    syncBtnState(st.u.syncing);

    st.u.body.querySelector("#gt-ms")?.addEventListener("click", () => void setMode("split"));
    st.u.body.querySelector("#gt-mm")?.addEventListener("click", () => void setMode("merged"));
    st.u.body.querySelector("#gt-va")?.addEventListener("click", () => {
      st.u.showAll = !st.u.showAll;
      renderHistory();
    });
    st.u.body.querySelector("#gt-sync")?.addEventListener("click", () => void syncNow());
    st.u.body.querySelector("#gt-export")?.addEventListener("click", () => exportHistory());
    st.u.body.querySelector("#gt-import")?.addEventListener("click", () => st.u.importInput?.click());
    st.u.importInput?.addEventListener("change", () => void importHistory());
    st.u.body.querySelector("#gt-ai")?.addEventListener("click", openAnalysisView);
  }

  function renderSettings() {
    st.u.body.innerHTML =
`<div class="Box mb-3">
  <div class="Box-header"><strong class="text-small">${e(t("lg"))}</strong></div>
  <div class="Box-body">
    <div class="text-small color-fg-muted mb-2">${e(t("ld"))}</div>
    <select id="gt-lang" class="form-select"><option value="zh-CN">${e(t("lz"))}</option><option value="en">${e(t("le"))}</option></select>
  </div>
</div>
<div class="Box mb-3">
  <div class="Box-header"><strong class="text-small">${e(t("wd"))}</strong></div>
  <div class="Box-body">
    <label class="d-flex flex-items-center text-small mb-2"><input id="gt-we" type="checkbox" style="margin-right:6px;" />${e(t("we"))}</label>
    <div class="gt-settings-grid">
      <input id="gt-wu" class="form-control input-block" type="text" placeholder="${e(t("pb"))}" />
      <input id="gt-wn" class="form-control input-block" type="text" placeholder="${e(t("pu"))}" />
      <input id="gt-wp" class="form-control input-block" type="password" placeholder="${e(t("pp"))}" />
    </div>
  </div>
</div>
<div class="Box mb-3">
  <div class="Box-header"><strong class="text-small">${e(t("ai_title"))}</strong></div>
  <div class="Box-body">
    <div class="gt-ai-note mb-2">${e(t("ai_default_note"))}</div>
    <div class="gt-settings-grid">
      <input id="gt-ai-url" class="form-control input-block" type="text" placeholder="https://api.openai.com/v1/chat/completions" />
      <input id="gt-ai-key" class="form-control input-block" type="password" placeholder="sk-..." />
      <input id="gt-ai-model" class="form-control input-block" type="text" placeholder="gpt-4o-mini" />
      <label class="text-small color-fg-muted">${e(t("ai_temp"))}: <span id="gt-ai-temp-val">0.7</span></label>
      <input id="gt-ai-temp" class="form-control input-block" type="range" min="0" max="2" step="0.1" value="0.7" />
      <textarea id="gt-ai-style" class="form-control input-block" placeholder="${e(t("ai_style"))}"></textarea>
      <textarea id="gt-ai-prompt" class="form-control input-block" placeholder="${e(t("ai_prompt"))}"></textarea>
    </div>
  </div>
</div>
<div class="gt-settings-actions"><button id="gt-save" type="button" class="Button Button--primary Button--small">${e(t("ss"))}</button></div>
<div class="gt-settings-danger">
  <div class="gt-danger-note">${e(t("cd"))}</div>
  <button id="gt-clear-settings" type="button" class="gt-tool-btn is-danger">${e(t("ca"))}</button>
</div>
<div id="gt-status" class="gt-status ${e(st.u.statusType)}"></div>`;

    st.u.statusNode = st.u.body.querySelector("#gt-status");
    st.u.syncBtn = null;
    st.u.langSel = st.u.body.querySelector("#gt-lang");
    st.u.wEn = st.u.body.querySelector("#gt-we");
    st.u.wUrl = st.u.body.querySelector("#gt-wu");
    st.u.wUser = st.u.body.querySelector("#gt-wn");
    st.u.wPass = st.u.body.querySelector("#gt-wp");
    st.u.aiUrl = st.u.body.querySelector("#gt-ai-url");
    st.u.aiKey = st.u.body.querySelector("#gt-ai-key");
    st.u.aiModel = st.u.body.querySelector("#gt-ai-model");
    st.u.aiTemp = st.u.body.querySelector("#gt-ai-temp");
    st.u.aiTempVal = st.u.body.querySelector("#gt-ai-temp-val");
    st.u.aiStyle = st.u.body.querySelector("#gt-ai-style");
    st.u.aiPrompt = st.u.body.querySelector("#gt-ai-prompt");
    fillSettings();
    paintStatus();
    st.u.aiTemp?.addEventListener("input", () => {
      if (st.u.aiTempVal) st.u.aiTempVal.textContent = String(st.u.aiTemp.value || "0.7");
    });
    st.u.body.querySelector("#gt-save")?.addEventListener("click", () => void saveSettings(false));
    st.u.body.querySelector("#gt-clear-settings")?.addEventListener("click", () => void clearAll());
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
    <div class="gt-about-version">Version: 1.1.0</div>
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
          <button type="button" class="gt-tool-btn" data-gt-ai-load="${sid}">${e(t("ai_load"))}</button>
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
`<details id="gt-ai-history" class="gt-ai-history"${detailsOpen}>
  <summary>${e(t("ai_history"))}</summary>
  <div class="gt-ai-history-list">${historyHtml}</div>
</details>
<div class="gt-tool-row">
  <button id="gt-ai-run" type="button" class="gt-tool-btn is-primary" ${runDisabled}>${e(runLabel)}</button>
</div>
<div class="gt-ai-thread-viewport">
  ${bodyHtml}
</div>
<div class="gt-ai-followup">
  <label class="text-small color-fg-muted">${e(t("ai_followup"))}</label>
  <textarea id="gt-ai-followup" class="form-control input-block" placeholder="${e(t("ai_followup_ph"))}" ${followupDisabled}></textarea>
  <div><button id="gt-ai-send" type="button" class="gt-tool-btn" ${followupDisabled}>${e(t("ai_send"))}</button></div>
</div>
<div id="gt-status" class="gt-status ${e(st.u.statusType)}"></div>`;
    st.u.statusNode = st.u.body.querySelector("#gt-status");
    st.u.syncBtn = null;
    st.u.aiFollowupInput = st.u.body.querySelector("#gt-ai-followup");
    paintStatus();
    st.u.body.querySelector("#gt-ai-run")?.addEventListener("click", () => void runAiAnalysisInitial());
    st.u.body.querySelector("#gt-ai-send")?.addEventListener("click", () => void runAiFollowup());
    st.u.aiFollowupInput?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
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
    if (!list.length) {
      if (mode === "repo") return `<div class="gt-list-empty">${e(t("nr"))}</div>`;
      if (mode === "user") return `<div class="gt-list-empty">${e(t("nu"))}</div>`;
      return `<div class="gt-list-empty">${e(t("nh"))}</div>`;
    }

    return list.map((it) => {
      const isRepo = it.__t === "repo";
      const name = isRepo ? `${it.owner}/${it.repo}` : it.username;
      const badge = mode === "merged" ? `<span class="Label Label--secondary">${e(isRepo ? t("tr") : t("tu"))}</span>` : "";
      return `<a class="Box-row d-block no-underline" href="${e(it.url)}"><div class="d-flex flex-items-center flex-justify-between"><div class="Link--primary text-bold">${e(name)}</div>${badge}</div><div class="gt-meta"><span>${e(fmt(it.lastVisitedAt))}</span><span>x${Number(it.visitCount || 0)}</span></div></a>`;
    }).join("");
  }

  async function setMode(mode) {
    if (mode !== "split" && mode !== "merged") return;
    st.c.ui.listMode = mode;
    st.u.showAll = false;
    await setV(CFG_KEY, st.c);
    renderHistory();
  }

  async function saveSettings(silent) {
    if (!st.u.langSel) return;
    const nextLang = st.u.langSel.value === "en" ? "en" : "zh-CN";
    st.c.language = nextLang;
    st.c.webdav.enabled = !!st.u.wEn.checked;
    st.c.webdav.baseUrl = String(st.u.wUrl.value || "").trim();
    st.c.webdav.username = String(st.u.wUser.value || "").trim();
    st.c.webdav.password = String(st.u.wPass.value || "");
    st.c.webdav.fileName = FILE;

    const nextAiUrl = String(st.u.aiUrl?.value || "").trim();
    if (nextAiUrl && !isValidAiApiUrl(nextAiUrl)) {
      setAiIssue(t("ai_url_invalid"));
      status(t("ai_url_invalid"), "error", 2200);
      return;
    }
    st.c.ai.apiUrl = nextAiUrl;
    st.c.ai.apiKey = String(st.u.aiKey?.value || "");
    st.c.ai.model = String(st.u.aiModel?.value || "").trim() || "gpt-4o-mini";
    st.c.ai.temperature = clampTemp(st.u.aiTemp?.value);
    const nextStyle = String(st.u.aiStyle?.value || "").trim();
    const nextPrompt = String(st.u.aiPrompt?.value || "").trim();
    st.c.ai.style = nextStyle || defaultAiStyle(nextLang);
    st.c.ai.prompt = nextPrompt || defaultAiPrompt(nextLang);
    await setV(CFG_KEY, st.c);
    clearAiIssue();
    renderSidebar();
    if (!silent) status(t("sv"), "info", 1800);
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
    URL.revokeObjectURL(url);
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
      if (!parsed || typeof parsed !== "object") {
        throw new Error(t("iu"));
      }
      const imported = normData(parsed);
      const count = Object.keys(imported.repo || {}).length + Object.keys(imported.user || {}).length;
      st.d = merge(st.d, imported);
      await setV(DATA_KEY, st.d);
      renderHistory();
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
      appendAiSession(session);
      st.u.activeAiSessionId = session.id;
      st.u.aiResult = result;
      st.u.aiError = "";
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
    const session = getActiveAiSession();
    if (!session) {
      status(t("ai_need_initial"), "error", 1800);
      return;
    }

    st.u.aiLoading = true;
    st.u.aiError = "";
    if (st.u.view === "analysis") renderAnalysis();
    let shouldRestoreInput = false;
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
      st.u.aiError = "";
      if (inputNode) inputNode.value = "";
    } catch (err) {
      shouldRestoreInput = true;
      st.u.aiError = err.message || "AI request failed.";
    } finally {
      st.u.aiLoading = false;
      if (st.u.view === "analysis") {
        renderAnalysis();
        if (shouldRestoreInput && st.u.aiFollowupInput) {
          st.u.aiFollowupInput.value = question;
        }
      }
    }
  }

  async function requestAiChat(messages) {
    const apiUrl = String(st.c.ai.apiUrl || "").trim();
    const apiKey = String(st.c.ai.apiKey || "");
    if (apiUrl && !isValidAiApiUrl(apiUrl)) {
      setAiIssue(t("ai_url_invalid"));
      throw new Error(t("ai_url_invalid"));
    }
    if (!apiUrl || !apiKey) {
      setAiIssue(t("ae"));
      throw new Error(t("ae"));
    }

    const safeMessages = Array.isArray(messages)
      ? messages
        .map((m) => ({
          role: m && typeof m.role === "string" ? m.role : "",
          content: m && typeof m.content === "string" ? m.content : "",
        }))
        .filter((m) => (m.role === "system" || m.role === "user" || m.role === "assistant") && m.content.trim())
        .slice(-40)
      : [];
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
      const content = parsed?.choices?.[0]?.message?.content;
      if (!content) throw new Error(t("ai_parse_fail"));
      clearAiIssue();
      return String(content);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : t("ai_parse_fail");
      setAiIssue(msg);
      throw new Error(msg);
    }
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
    const items = list.map((msg) => {
      const role = String(msg.role || "");
      const isUser = role === "user";
      const roleLabel = isUser ? t("ai_you") : t("ai_assistant");
      const content = isUser
        ? `<p>${e(String(msg.content || "")).replace(/\n/g, "<br>")}</p>`
        : renderMarkdownSafe(msg.content);
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
    const codeBlocks = [];
    const withCodeToken = escaped.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      const langClass = sanitizeLang(lang);
      const cls = langClass ? ` class="language-${langClass}"` : "";
      codeBlocks.push(`<pre><code${cls}>${code}</code></pre>`);
      return `@@GT_CODE_${idx}@@`;
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
      if (/^@@GT_CODE_\d+@@$/.test(trimLine)) {
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

    const merged = html.replace(/@@GT_CODE_(\d+)@@/g, (_, idx) => codeBlocks[Number(idx)] || "");
    return sanitizeHtml(merged || `<p>${e(t("ai_empty"))}</p>`);
  }

  function renderInlineMarkdown(text) {
    const safeText = String(text || "");
    const inlineCodes = [];
    let out = safeText.replace(/`([^`]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${code}</code>`);
      return `@@GT_INLINE_${idx}@@`;
    });
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, hrefRaw) => {
      const href = normalizeSafeHref(hrefRaw);
      if (!href) return label;
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/@@GT_INLINE_(\d+)@@/g, (_, idx) => inlineCodes[Number(idx)] || "");
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
    out.sessions = list.map((item, index) => normalizeAiSession(item, index))
      .filter(Boolean)
      .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
      .slice(0, AI_HISTORY_MAX_SESSIONS);
    return out;
  }

  function normalizeAiSession(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const now = new Date().toISOString();
    const id = String(raw.id || makeSessionId(index));
    const messagesRaw = Array.isArray(raw.messages) ? raw.messages : [];
    const messages = messagesRaw
      .map((m) => ({
        role: m && typeof m.role === "string" ? m.role : "",
        content: m && typeof m.content === "string" ? m.content : "",
      }))
      .filter((m) => (m.role === "system" || m.role === "user" || m.role === "assistant") && m.content.trim())
      .slice(0, 200);
    if (!messages.length) return null;
    return {
      id,
      title: String(raw.title || "").trim(),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
      messages,
    };
  }

  async function saveAiHistory() {
    try {
      await setV(AI_HISTORY_KEY, st.ah);
    } catch (_error) {
      // no-op
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

  function appendAiSession(session) {
    const normalized = normalizeAiSession(session, 0);
    if (!normalized) return;
    const next = st.ah.sessions.filter((x) => x.id !== normalized.id);
    next.unshift(normalized);
    st.ah.sessions = next.slice(0, AI_HISTORY_MAX_SESSIONS);
    void saveAiHistory();
  }

  function touchAiSession(sessionId) {
    const idx = st.ah.sessions.findIndex((x) => x.id === sessionId);
    if (idx <= 0) return;
    const item = st.ah.sessions[idx];
    st.ah.sessions.splice(idx, 1);
    st.ah.sessions.unshift(item);
  }

  function loadAiSession(sessionId) {
    const found = st.ah.sessions.find((x) => x.id === sessionId);
    if (!found) return false;
    st.u.activeAiSessionId = found.id;
    st.u.aiResult = "";
    st.u.aiError = "";
    if (st.u.view === "analysis") {
      renderAnalysis();
    } else {
      switchView("analysis");
    }
    return true;
  }

  async function clearAll() {
    if (!window.confirm(t("cc"))) return;
    st.d = defData();
    await setV(DATA_KEY, st.d);
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
      const merged = await syncWebDav(st.d, st.c.webdav);
      st.d = merged;
      await setV(DATA_KEY, st.d);
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
    const r = parseRoute(window.location.pathname);
    if (!r) return;
    const now = Date.now();
    if (st.last.p === r.pathname && now - st.last.t < 1200) return;
    st.last.p = r.pathname;
    st.last.t = now;
    const iso = new Date(now).toISOString();

    if (r.type === "repo") {
      const old = st.d.repo[r.key];
      st.d.repo[r.key] = {
        key: r.key, owner: r.owner, repo: r.repo, url: r.url, lastVisitedAt: iso,
        visitCount: old ? Number(old.visitCount || 0) + 1 : 1
      };
      prune(st.d.repo, maxItems());
    } else {
      const old = st.d.user[r.key];
      st.d.user[r.key] = {
        key: r.key, username: r.username, url: r.url, lastVisitedAt: iso,
        visitCount: old ? Number(old.visitCount || 0) + 1 : 1
      };
      prune(st.d.user, maxItems());
    }
    st.d.meta.updatedAt = iso;
    await setV(DATA_KEY, st.d);
  }

  function parseRoute(raw) {
    if (window.location.hostname !== "github.com") return null;
    const p = normPath(raw);
    if (p === "/" || excluded(p)) return null;
    const s = p.split("/").filter(Boolean);

    if (s.length === 1) {
      const u = s[0];
      if (!safeSeg(u) || RESERVED.has(u.toLowerCase())) return null;
      return { type: "user", key: u.toLowerCase(), username: u, url: `https://github.com/${u}`, pathname: p };
    }

    if (s.length === 2) {
      const o = s[0], r = s[1];
      if (!safeSeg(o) || !safeSeg(r) || RESERVED.has(o.toLowerCase())) return null;
      return { type: "repo", key: `${o.toLowerCase()}/${r.toLowerCase()}`, owner: o, repo: r, url: `https://github.com/${o}/${r}`, pathname: p };
    }

    return null;
  }

  function excluded(p) {
    return exPrefixes().some((x) => p === x || p.startsWith(`${x}/`));
  }

  function safeSeg(s) {
    return /^[A-Za-z0-9._-]+$/.test(s);
  }

  function normPath(p) {
    const n = p.replace(/\/{2,}/g, "/");
    return n.length > 1 && n.endsWith("/") ? n.slice(0, -1) : n;
  }

  async function syncWebDav(local, cfg) {
    const url = buildUrl(cfg.baseUrl, cfg.fileName);
    const headers = { Accept: "application/json" };
    if (cfg.username) headers.Authorization = `Basic ${b64(`${cfg.username}:${cfg.password || ""}`)}`;

    let remote = defData();
    const g = await req({ method: "GET", url, headers });
    if (g.status >= 200 && g.status < 300) {
      const txt = g.responseText || "";
      if (txt.trim()) {
        try { remote = normData(JSON.parse(txt)); }
        catch (_e) { throw new Error(t("ej")); }
      }
    } else if (g.status !== 404) {
      throw new Error(t("eg", { code: String(g.status) }));
    }

    const merged = merge(local, remote);
    const p = await req({
      method: "PUT",
      url,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
      data: JSON.stringify(merged, null, 2)
    });
    if (p.status < 200 || p.status >= 300) throw new Error(t("ep", { code: String(p.status) }));
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
    const out = {}, ks = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
    for (const k of ks) {
      const a = x ? x[k] : undefined, b = y ? y[k] : undefined;
      if (a && !b) { out[k] = cleanRec(a, k); continue; }
      if (b && !a) { out[k] = cleanRec(b, k); continue; }
      const win = ts(a.lastVisitedAt) >= ts(b.lastVisitedAt) ? a : b;
      out[k] = { ...cleanRec(win, k), visitCount: Math.max(Number(a.visitCount || 0), Number(b.visitCount || 0), 1) };
    }
    return out;
  }

  function cleanRec(r, k) {
    return {
      ...r,
      key: r.key || k,
      url: r.url || "",
      lastVisitedAt: r.lastVisitedAt || new Date().toISOString(),
      visitCount: Math.max(Number(r.visitCount || 0), 1)
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
    const file = (fileRaw || FILE).trim();
    const base = String(baseRaw || "").trim();
    if (!base) return file;
    if (base.endsWith(file)) return base;
    return base.endsWith("/") ? `${base}${file}` : `${base}/${file}`;
  }

  function b64(s) {
    return btoa(unescape(encodeURIComponent(s)));
  }

  function req(o) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: o.method,
        url: o.url,
        headers: o.headers || {},
        data: o.data,
        onload: (r) => resolve(r),
        onerror: () => reject(new Error(t("en"))),
        ontimeout: () => reject(new Error(t("et")))
      });
    });
  }

  async function getV(k, fb) {
    try {
      const v = GM_getValue(k, fb);
      return isP(v) ? await v : v;
    } catch (_e) {
      return fb;
    }
  }

  async function setV(k, v) {
    try {
      const r = GM_setValue(k, v);
      if (isP(r)) await r;
    } catch (_e) {
      // no-op
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
      ui: { listMode: "split" },
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
    out.version = Number(d.version || 1);
    out.repo = normMap(d.repo);
    out.user = normMap(d.user);
    out.meta.updatedAt = d.meta && typeof d.meta.updatedAt === "string" ? d.meta.updatedAt : "";
    prune(out.repo, MAX);
    prune(out.user, MAX);
    return out;
  }

  function normMap(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [k, v] of Object.entries(raw)) {
      if (!v || typeof v !== "object") continue;
      out[k] = cleanRec(v, k);
    }
    return out;
  }

  function normCfg(raw) {
    const out = defCfg();
    if (!raw || typeof raw !== "object") return out;
    out.language = raw.language === "en" ? "en" : "zh-CN";
    out.maxItemsPerType = Number(raw.maxItemsPerType || MAX);
    out.excludedPrefixes = Array.isArray(raw.excludedPrefixes) ? raw.excludedPrefixes.filter((x) => typeof x === "string") : [...EX];
    out.ui.listMode = raw.ui && raw.ui.listMode === "merged" ? "merged" : "split";
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
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : MAX;
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

  function triggerViewAnimation() {
    const body = st.u.body;
    if (!body) return;
    body.classList.remove("gt-view-enter");
    // Force reflow so repeated view switches still replay animation.
    void body.offsetWidth;
    body.classList.add("gt-view-enter");
    const style = window.getComputedStyle(body);
    const duration = Number.parseFloat(style.animationDuration || "0");
    if (!Number.isFinite(duration) || duration <= 0) {
      requestAnimationFrame(() => body.classList.remove("gt-view-enter"));
      return;
    }
    const done = () => {
      body.classList.remove("gt-view-enter");
      body.removeEventListener("animationend", done);
    };
    body.addEventListener("animationend", done);
  }

  function switchView(nextView) {
    if (!st.u.mounted) return;
    if (st.u.view === nextView) return;
    clearStatus();
    st.u.view = nextView;
    requestAnimationFrame(() => renderSidebar());
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
