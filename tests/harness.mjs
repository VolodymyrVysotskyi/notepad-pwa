// Test harness that runs the REAL inline <script type="module"> from
// index.html under a hand-rolled DOM. Not a reimplementation: the bytes we
// execute are the bytes we ship, so a test can only pass if index.html itself
// behaves. Not matched by `tests/*.test.mjs`, so `npm test` never runs it as a
// suite. Zero dependencies — no jsdom, no vitest.
//
// HOW IT WORKS
//   1. extract the script body from index.html
//   2. repoint its four imports (2 CDN stubs, real ./lib.mjs + ./pool.mjs)
//   3. prepend ONE line destructuring the environment out of a registry, so
//      `document`, `setTimeout`, `navigator`… are module-scoped consts that
//      shadow the globals for this module only
//   4. append `export const internals` exposing the module's private state
//   5. write to a temp dir, import it
//
// Why injection instead of patching globalThis: `navigator` doesn't exist on
// Node 20 (CI) and is a getter-only accessor on 22+ (local) — patching it is
// version-fragile both ways. Injection also keeps node:test's own timers real
// while the module under test gets a fake clock, and lets two instances hold
// two different clocks. `crypto`, `btoa`/`atob`, `TextEncoder` are deliberately
// NOT shadowed, so the module's real PBKDF2 + AES-GCM run for real and a test
// can decrypt the bytes it actually uploaded.
//
// WHAT THIS STUB CANNOT MODEL — do not write tests that claim these:
//   * No CSS engine. No `display:none`, no media queries, no ::before. "The
//     ghost is showing" can only ever be asserted as "data-placeholder is set".
//     Anything cascade-shaped belongs in tests/markup.test.mjs instead.
//   * No contenteditable mutation. Browsers insert <div>/<br> on Enter and
//     normalise pastes. Every such fixture here is a STATED ASSUMPTION about
//     what a browser leaves behind, not an observation.
//   * No event propagation. fire() invokes only listeners on the exact target.
//     `keydown` is registered on `document`; firing it on `editor` is a no-op.
//     preventDefault() only records.
//   * Selection is two fields (rangeCount, anchorNode). No ranges, no offsets,
//     and `selectionchange` never fires on its own.
//   * DOMPurify is identity. Never assert sanitisation with this harness.
//   * innerText does not collapse whitespace or do layout.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

export const INDEX_HTML = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// 1-2. Extract and transform
// ---------------------------------------------------------------------------
function extractScript() {
  const all = [...INDEX_HTML.matchAll(/<script type="module">\n([\s\S]*?)<\/script>/g)];
  if (all.length !== 1) {
    throw new Error(`harness: expected exactly 1 <script type="module"> in index.html, found ${all.length}`);
  }
  return all[0][1];
}

export const SCRIPT_SOURCE = extractScript();

// 1-based line of the script body's first line within index.html, so a stack
// frame from the transformed module maps back to the real file.
export const SCRIPT_LINE_OFFSET =
  INDEX_HTML.slice(0, INDEX_HTML.indexOf(SCRIPT_SOURCE)).split('\n').length;

// The harness is worthless if index.html's logic moves somewhere else and we
// end up exercising an empty file while every test still passes. Fail loudly.
const ANCHORS = [
  'function switchNotepad',
  'function updateGhost',
  'function pushCloud',
  'function savePage',
  'queuePush',
];
for (const a of ANCHORS) {
  if (!SCRIPT_SOURCE.includes(a)) {
    throw new Error(
      `harness: anchor '${a}' missing from index.html's inline script — the logic moved, ` +
      `so these tests would exercise nothing. Update the harness deliberately.`);
  }
}

function replaceOnce(src, re, to, what) {
  const n = (src.match(re) || []).length;
  if (n !== 1) throw new Error(`harness: expected exactly 1 ${what} import, found ${n}`);
  return src.replace(re, to);
}

function transform(id) {
  let s = SCRIPT_SOURCE;
  s = replaceOnce(s, /from 'https:\/\/esm\.sh\/@supabase\/supabase-js[^']*'/,
    `from './supabase-${id}.mjs'`, 'supabase-js');
  s = replaceOnce(s, /from 'https:\/\/esm\.sh\/dompurify[^']*'/,
    `from './dompurify-${id}.mjs'`, 'dompurify');
  s = replaceOnce(s, /from '\.\/lib\.mjs'/,
    `from '${pathToFileURL(path.join(REPO, 'lib.mjs')).href}'`, './lib.mjs');
  s = replaceOnce(s, /from '\.\/pool\.mjs'/,
    `from '${pathToFileURL(path.join(REPO, 'pool.mjs')).href}'`, './pool.mjs');

  // A version bump that slips past the regexes above would leave a live
  // network import and hang CI with an opaque DNS error.
  if (/from\s+['"]https?:/.test(s)) {
    throw new Error('harness: a remote import survived rewriting — CI would hit the network');
  }

  // ONE line, so every line number below still matches index.html.
  const inject = `const { document, window, navigator, localStorage, sessionStorage, caches, confirm, Node, setTimeout, clearTimeout } = globalThis.__NOTEPAD_HARNESS__['${id}'].env;\n`;

  // Getters are mandatory: `pages` and `currentPage` are REASSIGNED by enter()
  // / switchNotepad() / loadPage(), so a snapshot would go stale mid-test.
  const expose = `
export const internals = {
  get pages() { return pages; }, set pages(v) { pages = v; },
  get currentPage() { return currentPage; }, set currentPage(v) { currentPage = v; },
  get hint() { return hint; }, set hint(v) { hint = v; },
  get cryptoKey() { return cryptoKey; }, set cryptoKey(v) { cryptoKey = v; },
  get phraseId() { return phraseId; }, set phraseId(v) { phraseId = v; },
  get firstPromptUsed() { return firstPromptUsed; }, set firstPromptUsed(v) { firstPromptUsed = v; },
  get currentGhostEl() { return currentGhostEl; },
  AI,
  deriveKey, deriveId, encryptJSON, decryptJSON,
  pullCloud, pushCloud, queuePush, setSyncStatus,
  reloadEditor, loadPage, updateUI, nextPage, prevPage, clearPage, savePage, updateWordCount,
  clearGhost, blockIsEmpty, findCurrentBlock, ghostCopyForLine, updateGhost,
  enter, switchNotepad, saveHint,
};
`;
  return inject + s + expose;
}

// ---------------------------------------------------------------------------
// Fake clock — injected, not global. node:test's mock.timers discards callback
// return values, and pushCloud awaits real WebCrypto (threadpool, not a
// microtask), so we need a tick() that can AWAIT what it fired.
// ---------------------------------------------------------------------------
function makeClock() {
  let now = 0, seq = 0;
  let pending = [];
  return {
    get now() { return now; },
    get count() { return pending.length; },
    pending() { return pending.map(t => ({ id: t.id, due: t.due })); },
    setTimeout(fn, ms = 0) {
      const t = { id: ++seq, due: now + Number(ms || 0), fn };
      pending.push(t);
      return t.id;
    },
    clearTimeout(id) {
      // The module calls this on `null` on the very first keystroke.
      if (id == null) return;
      pending = pending.filter(t => t.id !== id);
    },
    async tick(ms) {
      const target = now + ms;
      let guard = 0;
      for (;;) {
        const due = pending.filter(t => t.due <= target)
          .sort((a, b) => a.due - b.due || a.id - b.id);
        if (!due.length) break;
        if (++guard > 10000) throw new Error('harness: runaway timer loop in clock.tick');
        const t = due[0];
        // Advance to the timer BEFORE firing, so a callback that schedules
        // another one (savePage -> queuePush) computes its due time off the
        // real current time, not off the tick target.
        now = t.due;
        pending = pending.filter(x => x.id !== t.id);
        await t.fn();
      }
      now = target;
    },
  };
}

// ---------------------------------------------------------------------------
// DOM stub
// ---------------------------------------------------------------------------
const VOID_TAGS = new Set(['br', 'img', 'hr', 'input', 'wbr', 'source', 'meta', 'link']);
const BLOCK_TAGS = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'section', 'blockquote']);

// Mirror lib.mjs's quote-aware tag pattern so `title="1 > 2"` doesn't truncate
// a tag here either — the exact trap lib.mjs documents twice.
const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

function decodeEntities(s) {
  return s
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

class El {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this._doc = doc;
    this.parentNode = null;
    this.children = [];
    this.childNodes = [];
    this.attrs = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.className = '';
    this.disabled = false;
    this.parseWarnings = [];
  }

  // --- content -------------------------------------------------------------
  get innerHTML() { return this._html ?? ''; }
  set innerHTML(v) {
    this._html = String(v ?? '');
    this.children = [];
    this.childNodes = [];
    this.parseWarnings = [];
    this._parse(this._html);
  }

  _parse(html) {
    const stack = [this];
    let last = 0;
    TAG_RE.lastIndex = 0;
    let m;
    const pushText = (raw) => {
      if (!raw) return;
      const t = { nodeType: 3, textContent: decodeEntities(raw), parentNode: stack.at(-1) };
      stack.at(-1).childNodes.push(t);
    };
    while ((m = TAG_RE.exec(html))) {
      pushText(html.slice(last, m.index));
      last = TAG_RE.lastIndex;
      const [, slash, tag, attrs] = m;
      const lower = tag.toLowerCase();
      if (slash) {
        if (stack.length > 1 && stack.at(-1).tagName === tag.toUpperCase()) stack.pop();
        else this.parseWarnings.push(`unmatched </${tag}>`);
        continue;
      }
      const el = new El(tag, this._doc);
      el.parentNode = stack.at(-1);
      for (const a of attrs.matchAll(/([\w-]+)\s*=\s*"([^"]*)"|([\w-]+)\s*=\s*'([^']*)'/g)) {
        el.attrs.set(a[1] ?? a[3], a[2] ?? a[4] ?? '');
      }
      stack.at(-1).children.push(el);
      stack.at(-1).childNodes.push(el);
      if (!VOID_TAGS.has(lower)) stack.push(el);
    }
    pushText(html.slice(last));
    if (stack.length > 1) this.parseWarnings.push('unclosed tag');
  }

  get textContent() {
    return this.childNodes.map(n => (n.nodeType === 3 ? n.textContent : n.textContent)).join('');
  }
  set textContent(v) {
    const s = String(v ?? '');
    this.children = [];
    this.childNodes = s ? [{ nodeType: 3, textContent: s, parentNode: this }] : [];
    this._html = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Block boundaries become \n, which is exactly the contract
  // updateWordCount() relies on (wordCountOf splits on \s+).
  get innerText() {
    const parts = [];
    for (const n of this.childNodes) {
      if (n.nodeType === 3) { parts.push(n.textContent); continue; }
      if (n.tagName === 'BR') { parts.push('\n'); continue; }
      const inner = n.innerText;
      // A block starts a new line only if something already precedes it.
      parts.push(BLOCK_TAGS.has(n.tagName.toLowerCase()) && parts.length ? `\n${inner}` : inner);
    }
    return parts.join('');
  }

  // --- attributes ----------------------------------------------------------
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
  hasAttribute(k) { return this.attrs.has(k); }
  toggleAttribute(k, force) {
    const on = force === undefined ? !this.attrs.has(k) : !!force;
    if (on) this.attrs.set(k, ''); else this.attrs.delete(k);
    return on;
  }

  // --- events / focus ------------------------------------------------------
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const l = this.listeners.get(type);
    if (l) this.listeners.set(type, l.filter(f => f !== fn));
  }
  focus() { this._doc.activeElement = this; }
  blur() { if (this._doc.activeElement === this) this._doc.activeElement = null; }
}

function makeEnv(opts) {
  const clock = makeClock();
  const calls = {
    execCommand: [], confirm: [], reload: 0, cachesDeleted: [], unregistered: 0,
  };

  const doc = {
    activeElement: null,
    visibilityState: 'visible',
    listeners: new Map(),
    _els: new Map(),
    getElementById(id) {
      if (!this._els.has(id)) throw new Error(`harness: unknown element id '${id}' — index.html asks for it but the harness doesn't define it`);
      return this._els.get(id);
    },
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const l = this.listeners.get(type);
      if (l) this.listeners.set(type, l.filter(f => f !== fn));
    },
    execCommand(...args) { calls.execCommand.push(args); return true; },
  };

  // Every id index.html's DOM section reads.
  const IDS = [
    'phraseScreen', 'phraseForm', 'phraseInput', 'phraseToggle', 'eyeIconOpen',
    'eyeIconClosed', 'phraseError', 'enterBtn', 'aiIntro', 'appHeader',
    'appContainer', 'appFooter', 'editor', 'wordCount', 'pageInfo', 'prevBtn',
    'nextBtn', 'switchBtn', 'clearBtn', 'syncStatus', 'hint',
  ];
  const TAGS = {
    phraseScreen: 'div', phraseForm: 'form', phraseInput: 'input', phraseToggle: 'button',
    eyeIconOpen: 'svg', eyeIconClosed: 'svg', phraseError: 'div', enterBtn: 'button',
    aiIntro: 'p', appHeader: 'header', appContainer: 'div', appFooter: 'footer',
    editor: 'div', wordCount: 'span', pageInfo: 'span', prevBtn: 'button',
    nextBtn: 'button', switchBtn: 'button', clearBtn: 'button', syncStatus: 'span', hint: 'h1',
  };
  for (const id of IDS) {
    const el = new El(TAGS[id], doc);
    el.id = id;
    if (id === 'phraseInput') { el.value = ''; el.type = 'text'; }
    doc._els.set(id, el);
  }

  let selection = { rangeCount: 0, anchorNode: null };

  const win = {
    listeners: new Map(),
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const l = this.listeners.get(type);
      if (l) this.listeners.set(type, l.filter(f => f !== fn));
    },
    getSelection() { return selection; },
    location: { reload() { calls.reload++; } },
    caches: undefined, // set below so `'caches' in window` is true
  };

  const caches = {
    async keys() { return [...(opts.cacheKeys || [])]; },
    async delete(k) { calls.cachesDeleted.push(k); return true; },
  };
  win.caches = caches;

  const storage = () => {
    const data = new Map();
    const removed = [];
    return {
      data, removed,
      getItem: k => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: k => { removed.push(k); data.delete(k); },
    };
  };
  const local = storage(), session = storage();

  const navigatorStub = {
    onLine: true,
    serviceWorker: {
      async getRegistrations() {
        return (opts.serviceWorkerRegs || []).map(() => ({
          async unregister() { calls.unregistered++; return true; },
        }));
      },
    },
  };

  const env = {
    document: doc,
    window: win,
    navigator: navigatorStub,
    localStorage: local,
    sessionStorage: session,
    caches,
    confirm: (msg) => {
      calls.confirm.push(msg);
      return typeof opts.confirmResult === 'function'
        ? opts.confirmResult(msg)
        : (opts.confirmResult ?? true);
    },
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
    clearTimeout: (id) => clock.clearTimeout(id),
  };

  return {
    env, doc, win, clock, calls, storage: { local, session },
    setSelection(next) { selection = { rangeCount: next.anchorNode ? 1 : 0, ...next }; },
  };
}

// ---------------------------------------------------------------------------
// Supabase stub controller
// ---------------------------------------------------------------------------
function makeSupabase() {
  const ctl = {
    upserts: [], selects: [], clients: [],
    stored: null, selectError: null, upsertError: null,
    get lastUpsert() { return ctl.upserts.at(-1); },
    reset() { ctl.upserts = []; ctl.selects = []; },
  };
  ctl.client = {
    from(table) {
      return {
        select(columns) {
          const rec = { table, columns, filters: [] };
          ctl.selects.push(rec);
          const chain = {
            eq(col, val) { rec.filters.push([col, val]); return chain; },
            async maybeSingle() { return { data: ctl.stored, error: ctl.selectError }; },
          };
          return chain;
        },
        async upsert(row) {
          ctl.upserts.push(row);
          return { data: null, error: ctl.upsertError };
        },
      };
    },
  };
  return ctl;
}

// ---------------------------------------------------------------------------
// loadApp
// ---------------------------------------------------------------------------
let tmpDir = null;
let counter = 0;

function tmp() {
  if (!tmpDir) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notepad-harness-'));
    process.on('exit', () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });
  }
  return tmpDir;
}

export async function loadApp(opts = {}) {
  const id = `h${++counter}`;
  const dir = tmp();
  const ctx = makeEnv(opts);
  const supabase = makeSupabase();
  if (opts.stored !== undefined) supabase.stored = opts.stored;
  if (opts.selectError !== undefined) supabase.selectError = opts.selectError;
  if (opts.upsertError !== undefined) supabase.upsertError = opts.upsertError;

  const dompurify = { calls: [], impl: opts.sanitize || (h => h) };

  globalThis.__NOTEPAD_HARNESS__ = globalThis.__NOTEPAD_HARNESS__ || {};
  globalThis.__NOTEPAD_HARNESS__[id] = { env: ctx.env, supabase, dompurify };

  for (const [k, v] of Object.entries(ctx.env)) {
    if (v === undefined) throw new Error(`harness: env.${k} is undefined — the module's top-level IIFE would reject`);
  }

  // The stubs must read the registry LAZILY: `import` declarations hoist above
  // the injected `const` line, so module-evaluation-time lookups see nothing.
  fs.writeFileSync(path.join(dir, `supabase-${id}.mjs`),
    `export function createClient(url, key) {
       const h = globalThis.__NOTEPAD_HARNESS__['${id}'];
       h.supabase.clients.push({ url, key });
       return h.supabase.client;
     }\n`);
  fs.writeFileSync(path.join(dir, `dompurify-${id}.mjs`),
    `export default {
       sanitize(html) {
         const h = globalThis.__NOTEPAD_HARNESS__['${id}'];
         h.dompurify.calls.push(html);
         return h.dompurify.impl(html);
       }
     };\n`);
  const appPath = path.join(dir, `app-${id}.mjs`);
  fs.writeFileSync(appPath, transform(id));

  // The top-level SW-cleanup IIFE rejects asynchronously; without this capture
  // node:test blames whichever test happens to be running.
  let bootError = null;
  const onRej = (e) => { bootError = e; };
  process.on('unhandledRejection', onRej);
  let ns;
  try {
    ns = await import(pathToFileURL(appPath).href);
    // Let the async IIFE settle before any assertion runs.
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
  } finally {
    process.off('unhandledRejection', onRej);
  }
  if (bootError) throw new Error(`harness: index.html's top-level script rejected: ${bootError}`);

  const ids = Object.fromEntries([...ctx.doc._els].map(([k, v]) => [k === 'hint' ? 'hintEl' : k, v]));

  function listenersOf(target, type) {
    const map = target.listeners;
    return (map && map.get(type)) || [];
  }

  function makeEvent(init) {
    return {
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      defaultPrevented: false,
      ...init,
    };
  }

  const inst = {
    internals: ns.internals,
    ids,
    document: ctx.doc,
    window: ctx.win,
    clock: ctx.clock,
    supabase,
    dompurify,
    storage: ctx.storage,
    calls: ctx.calls,
    setSelection: ctx.setSelection,

    listenerCount(target, type) { return listenersOf(target, type).length; },

    listenerInventory() {
      const out = [];
      const label = (t) => {
        if (t === ctx.doc) return 'document';
        if (t === ctx.win) return 'window';
        for (const [k, v] of ctx.doc._els) if (v === t) return k;
        return '?';
      };
      for (const t of [ctx.doc, ctx.win, ...ctx.doc._els.values()]) {
        for (const [type, fns] of t.listeners) if (fns.length) out.push(`${label(t)}/${type}`);
      }
      return out.sort();
    },

    fire(target, type, init = {}) {
      const fns = [...listenersOf(target, type)];
      const ev = makeEvent(init);
      for (const fn of fns) fn(ev);
      return fns.length;
    },

    // Default to this: a test that fires into the void must fail, not pass.
    mustFire(target, type, init = {}) {
      const n = inst.fire(target, type, init);
      if (n === 0) throw new Error(`harness: no '${type}' listener on target — test would be vacuous`);
      return n;
    },

    type(el, html) {
      el.innerHTML = html;
      inst.mustFire(el, 'input');
    },

    focus(el) { ctx.doc.activeElement = el; inst.fire(el, 'focus'); },
    blur(el) { if (ctx.doc.activeElement === el) ctx.doc.activeElement = null; inst.fire(el, 'blur'); },

    dispose() {
      delete globalThis.__NOTEPAD_HARNESS__[id];
      for (const f of [`app-${id}.mjs`, `supabase-${id}.mjs`, `dompurify-${id}.mjs`]) {
        try { fs.rmSync(path.join(dir, f)); } catch {}
      }
    },
  };
  return inst;
}
