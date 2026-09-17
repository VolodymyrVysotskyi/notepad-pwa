// Pure helpers extracted from index.html so they can be unit-tested under
// `npm test` (= `node --test tests/*.test.mjs`). A bare directory argument
// (`node --test tests/`) is resolved as a module path by current Node and
// fails. Anything DOM-coupled stays in index.html; this file is import-safe
// in both the browser (as a module) and Node.

export function aiContext(now = new Date()) {
  const tags = [];
  const h = now.getHours();
  if (h >= 23 || h < 4) tags.push('late-night');
  else if (h < 8) tags.push('early-morning');
  else if (h < 12) tags.push('morning');
  else if (h < 17) tags.push('afternoon');
  else if (h < 21) tags.push('evening');
  else tags.push('night');

  const day = now.getDay();
  if (day === 1) tags.push('monday');
  else if (day === 5) tags.push('friday');
  else if (day === 0 || day === 6) tags.push('weekend');
  else tags.push('midweek');

  return tags;
}

export function pickByContext(pool, ctx, rng = Math.random) {
  const matching = pool.filter(p => p.tags.length && p.tags.some(t => ctx.includes(t)));
  const fallback = pool.filter(p => p.tags.length === 0);
  const set = matching.length ? matching : fallback;
  if (!set.length) throw new Error('pickByContext: empty pool');
  return set[Math.floor(rng() * set.length)].line;
}

export function poolByContext(pool, ctx) {
  const matching = pool.filter(p => p.tags.length && p.tags.some(t => ctx.includes(t)));
  const fallback = pool.filter(p => p.tags.length === 0);
  // Context-tagged lines first so they show on early line indices; defaults
  // round out the pool so any rowPlaceholder index still resolves to a line.
  return [...matching.map(p => p.line), ...fallback.map(p => p.line)];
}

// Quote-aware opening-tag pattern, shared by every helper below that has to
// tell markup from text. `[^>]*` alone stops at the first `>` anywhere in the
// tag, including one inside a quoted attribute value (e.g. title="1 > 2") —
// which silently drops the match. Matching quoted spans as a unit lets `>`
// appear freely inside them while still ending the tag at an unquoted `>`.
// Kept in one place so the two consumers can't drift apart.
const TAG_NAME = '[a-zA-Z][\\w-]*';
const TAG_ATTRS = '(?:"[^"]*"|\'[^\']*\'|[^\'">])*';
const OPEN_TAG_RE = new RegExp(`<(${TAG_NAME})(${TAG_ATTRS})>`, 'g');
const ANY_TAG_RE = new RegExp(`</?${TAG_NAME}${TAG_ATTRS}>`, 'g');

// Strip data-placeholder before persisting — the attribute is a runtime hint
// for the ghost-text CSS, not part of the user's content. Match the whole
// opening tag and remove the attribute from inside it, so a literal
// `data-placeholder="x"` typed in text content (e.g. a note documenting HTML)
// is left alone. The earlier flat regex stripped from text content too.
export function cleanForSave(html) {
  return (html || '').replace(OPEN_TAG_RE, (_, tag, attrs) =>
    `<${tag}${attrs.replace(/\s+data-placeholder="[^"]*"/g, '')}>`);
}

// Embedded content carries no text of its own but is unmistakably content — a
// page holding nothing but a pasted image must never be treated as blank.
const EMBEDDED_RE = /<(?:img|video|audio|iframe|object|embed|svg|canvas|hr|input|table)\b/i;

// Is this editor HTML *visually* empty? A plain `.trim() === ''` check is not
// enough: contenteditable leaves browser-inserted markup behind the moment a
// page is focused and typed into then emptied — `<br>`, `<div><br></div>`,
// `&nbsp;` — all of which trim reports as content. pruneEmptyPages relied on
// trim, so the blank pages users actually create were never pruned.
//
// Anything unparseable leaves residue and reads as non-blank, so the
// conservative outcome is always "keep the page", never a silent delete.
export function htmlIsBlank(html) {
  const s = String(html || '');
  if (EMBEDDED_RE.test(s)) return false;
  const text = s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(ANY_TAG_RE, '')
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, ' ')
    .replace(/\u00a0/g, ' ');
  return text.trim() === '';
}

export function wordCountOf(text) {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// DOM-light helpers used by index.html — kept testable by accepting plain
// objects with a textContent property.

// Why pushCloud calls this rather than relying on a debounced saveHint(): the
// editor and hint inputs share an autoSaveTimer, so a hint edit followed by an
// editor edit within 1s cancels the queued saveHint and the in-memory `hint`
// stays stale. Reading from the element at push time makes the DOM the single
// source of truth.
export function readHintFromEl(el, max = 120) {
  const s = ((el && el.textContent) || '').trim().slice(0, max);
  // .slice() cuts by UTF-16 code unit, which can land inside a surrogate
  // pair (e.g. an emoji) and leave a dangling lone high surrogate behind.
  const last = s.charCodeAt(s.length - 1);
  return (last >= 0xd800 && last <= 0xdbff) ? s.slice(0, -1) : s;
}

// Returns 'next' | 'prev' | null based on a touch swipe's deltas. A swipe
// only counts when |dx| exceeds threshold AND dominates |dy| — a vertical
// scroll with incidental horizontal drift must not flip pages.
export function swipeIntent(dx, dy, threshold = 50) {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'prev';
}

// Drops abandoned blank pages (page number > 1, no visible content per
// htmlIsBlank)
// from the pages map — except keepPage, the page we're navigating TO. Without
// the keepPage exclusion, calling this right after creating a fresh blank
// page (nextPage()'s "add a new page" branch) deletes that same page before
// it's ever shown, leaving pageInfo/prevBtn out of sync with the real page
// count. Page 1 is always kept regardless of content. Returns a new object;
// does not mutate the input.
export function pruneEmptyPages(pages, keepPage) {
  const keep = Number(keepPage);
  const result = { ...pages };
  for (const p of Object.keys(result)) {
    const n = Number(p);
    if (n > 1 && n !== keep && htmlIsBlank(result[p])) {
      delete result[p];
    }
  }
  return result;
}

// Resolves which page to actually show. `pages[currentPage]` can legitimately
// be '' (an existing blank page) — that must not be confused with the key
// being entirely absent (e.g. currentPage points at a page that was pruned or
// never existed in synced cloud state). Falls back to the lowest existing
// page number, or 1 if pages is empty. Always returns a Number: every
// consumer does nums.indexOf(currentPage) against Object.keys().map(Number),
// and a string key would miss (-1) and desync the footer and prev button.
export function resolveCurrentPage(pages, currentPage) {
  if (pages[currentPage] !== undefined) return Number(currentPage);
  const nums = Object.keys(pages).map(Number).sort((a, b) => a - b);
  return nums.length ? nums[0] : 1;
}

// Footer position + prev-button state. `currentPage` is a page KEY, not an
// ordinal — pruneEmptyPages leaves gaps in the numbering (e.g. {1, 3}) — so
// the old `${currentPage} / ${nums.length}` rendered nonsense like "3 / 2"
// once a mid-book page was pruned. Derive the position from the sorted key
// list instead, the same indexOf the prev button already trusted. An absent
// key reports position 1 so the footer can never show "0 / n".
export function pageLabel(pages, currentPage) {
  const nums = Object.keys(pages || {}).map(Number).sort((a, b) => a - b);
  const idx = nums.indexOf(Number(currentPage));
  return {
    position: idx >= 0 ? idx + 1 : 1,
    total: nums.length || 1,
    isFirst: idx <= 0,
  };
}
