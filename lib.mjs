// Pure helpers extracted from index.html so they can be unit-tested under
// `node --test tests/`. Anything DOM-coupled stays in index.html; this file
// is import-safe in both the browser (as a module) and Node.

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

// Strip data-placeholder before persisting — the attribute is a runtime hint
// for the ghost-text CSS, not part of the user's content. Match the whole
// opening tag and remove the attribute from inside it, so a literal
// `data-placeholder="x"` typed in text content (e.g. a note documenting HTML)
// is left alone. The earlier flat regex stripped from text content too.
//
// The attrs group is quote-aware: `[^>]*` alone stops at the first `>`
// anywhere in the tag, including one inside a quoted attribute value (e.g.
// title="1 > 2"), which silently drops the match and leaves data-placeholder
// un-stripped. Matching quoted spans as a unit lets `>` appear freely inside
// them while still ending the tag at an unquoted `>`.
export function cleanForSave(html) {
  return (html || '').replace(/<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g, (_, tag, attrs) =>
    `<${tag}${attrs.replace(/\s+data-placeholder="[^"]*"/g, '')}>`);
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
  return ((el && el.textContent) || '').trim().slice(0, max);
}

// Returns 'next' | 'prev' | null based on a touch swipe's deltas. A swipe
// only counts when |dx| exceeds threshold AND dominates |dy| — a vertical
// scroll with incidental horizontal drift must not flip pages.
export function swipeIntent(dx, dy, threshold = 50) {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'prev';
}
