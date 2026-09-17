import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiContext, pickByContext, poolByContext,
  cleanForSave, htmlIsBlank, wordCountOf, readHintFromEl, swipeIntent,
  pruneEmptyPages, resolveCurrentPage, pageLabel,
} from '../lib.mjs';
import { POOL } from '../pool.mjs';

// new Date(year, monthIndex, day, hour) gives a *local* time, which matches
// aiContext()'s use of getHours/getDay. 2026-05-04 is a Monday.
const at = (y, m, d, h) => new Date(y, m, d, h, 0, 0, 0);

test('aiContext: hour-of-day boundaries', () => {
  // weekday wrappers held constant — only inspect the time tag (index 0).
  const tag = (h) => aiContext(at(2026, 4, 6, h))[0]; // 2026-05-06 is a Wed (midweek)
  assert.equal(tag(0), 'late-night');
  assert.equal(tag(3), 'late-night');
  assert.equal(tag(4), 'early-morning');
  assert.equal(tag(7), 'early-morning');
  assert.equal(tag(8), 'morning');
  assert.equal(tag(11), 'morning');
  assert.equal(tag(12), 'afternoon');
  assert.equal(tag(16), 'afternoon');
  assert.equal(tag(17), 'evening');
  assert.equal(tag(20), 'evening');
  assert.equal(tag(21), 'night');
  assert.equal(tag(22), 'night');
  assert.equal(tag(23), 'late-night');
});

test('aiContext: day-of-week mapping', () => {
  // Pick a stable hour (10 → 'morning') and walk through May 3–9, 2026 (Sun→Sat).
  const day = (d) => aiContext(at(2026, 4, d, 10))[1];
  assert.equal(day(3), 'weekend'); // Sun
  assert.equal(day(4), 'monday');
  assert.equal(day(5), 'midweek'); // Tue
  assert.equal(day(6), 'midweek'); // Wed
  assert.equal(day(7), 'midweek'); // Thu
  assert.equal(day(8), 'friday');
  assert.equal(day(9), 'weekend'); // Sat
});

test('aiContext: combined cases', () => {
  assert.deepEqual(aiContext(at(2026, 4, 4, 2)), ['late-night', 'monday']);
  assert.deepEqual(aiContext(at(2026, 4, 9, 9)), ['morning', 'weekend']);
  assert.deepEqual(aiContext(at(2026, 4, 6, 23)), ['late-night', 'midweek']);
  assert.deepEqual(aiContext(at(2026, 4, 8, 13)), ['afternoon', 'friday']);
});

test('pickByContext: prefers tagged matches', () => {
  const pool = [
    { tags: [], line: 'default' },
    { tags: ['monday'], line: 'mon-A' },
    { tags: ['monday'], line: 'mon-B' },
    { tags: ['friday'], line: 'fri' },
  ];
  // Pin RNG to 0 → first matching item.
  assert.equal(pickByContext(pool, ['monday'], () => 0), 'mon-A');
  // Pin RNG to 0.99 → last matching item (matching set has 2; floor(0.99*2)=1).
  assert.equal(pickByContext(pool, ['monday'], () => 0.99), 'mon-B');
});

test('pickByContext: falls back to untagged when nothing matches', () => {
  const pool = [
    { tags: [], line: 'default-A' },
    { tags: [], line: 'default-B' },
    { tags: ['monday'], line: 'mon' },
  ];
  assert.equal(pickByContext(pool, ['friday'], () => 0), 'default-A');
  assert.equal(pickByContext(pool, ['friday'], () => 0.99), 'default-B');
});

test('pickByContext: empty pool throws', () => {
  assert.throws(() => pickByContext([], ['monday']), /empty pool/);
});

test('poolByContext: matching first then fallback, order preserved', () => {
  const pool = [
    { tags: [], line: 'd1' },
    { tags: ['monday'], line: 'm1' },
    { tags: [], line: 'd2' },
    { tags: ['monday'], line: 'm2' },
    { tags: ['friday'], line: 'f1' },
  ];
  assert.deepEqual(poolByContext(pool, ['monday']), ['m1', 'm2', 'd1', 'd2']);
  assert.deepEqual(poolByContext(pool, ['friday']), ['f1', 'd1', 'd2']);
  // No matching tag → only fallback in original order.
  assert.deepEqual(poolByContext(pool, ['weekend']), ['d1', 'd2']);
});

test('cleanForSave: strips data-placeholder attributes', () => {
  assert.equal(cleanForSave(''), '');
  assert.equal(cleanForSave(null), '');
  assert.equal(cleanForSave(undefined), '');
  assert.equal(
    cleanForSave('<div data-placeholder="hi">x</div>'),
    '<div>x</div>'
  );
  assert.equal(
    cleanForSave('<p>a</p><div data-placeholder="ghost">b</div><p>c</p>'),
    '<p>a</p><div>b</div><p>c</p>'
  );
  // Multiple occurrences.
  assert.equal(
    cleanForSave('<div data-placeholder="A"></div><p data-placeholder="B"></p>'),
    '<div></div><p></p>'
  );
  // Doesn't touch other attributes.
  assert.equal(
    cleanForSave('<div class="x" data-placeholder="A" id="y">hello</div>'),
    '<div class="x" id="y">hello</div>'
  );
  // First attribute on the tag — `\s+` still matches the single space between
  // tag name and first attribute.
  assert.equal(
    cleanForSave('<div data-placeholder="A" class="x">y</div>'),
    '<div class="x">y</div>'
  );
});

// A `>` inside a quoted attribute value must not be mistaken for the end of
// the opening tag — the earlier `[^>]*` regex stopped there, so the tag never
// matched at all and data-placeholder survived into the saved HTML.
test('cleanForSave: > inside a quoted attribute value does not break the match', () => {
  assert.equal(
    cleanForSave('<div title="1 > 2" data-placeholder="ghost">content</div>'),
    '<div title="1 > 2">content</div>'
  );
  // Also when the `>`-bearing attribute comes after data-placeholder.
  assert.equal(
    cleanForSave('<div data-placeholder="ghost" title="1 > 2">content</div>'),
    '<div title="1 > 2">content</div>'
  );
  // And with a single-quoted value.
  assert.equal(
    cleanForSave("<div title='1 > 2' data-placeholder=\"ghost\">content</div>"),
    "<div title='1 > 2'>content</div>"
  );
});

// The strip regex requires whitespace before the attribute so it cannot match
// inside text content. A user writing notes that literally quote the attribute
// syntax (e.g. documenting HTML) must keep that text on save.
test('cleanForSave: does not strip from text content', () => {
  assert.equal(
    cleanForSave('<p>Use data-placeholder="hi" for ghost text</p>'),
    '<p>Use data-placeholder="hi" for ghost text</p>'
  );
  // At the very start of text content (no leading space at all).
  assert.equal(
    cleanForSave('<p>data-placeholder="x" is an attribute</p>'),
    '<p>data-placeholder="x" is an attribute</p>'
  );
});

// Idempotent: running cleanForSave twice yields the same result as once.
// Locks the contract so any future addition to the strip pass stays safe to
// re-run (e.g. on a value already pulled back from the cloud).
test('cleanForSave: idempotent', () => {
  const cases = [
    '',
    '<div data-placeholder="A" class="x">y</div>',
    '<p>plain</p>',
    '<div data-placeholder="A"></div><p data-placeholder="B"></p>',
    '<p>data-placeholder="x" in text</p>',
  ];
  for (const html of cases) {
    const once = cleanForSave(html);
    assert.equal(cleanForSave(once), once, `not idempotent for: ${html}`);
  }
});

// Documented limitation: the stripping half of the regex only matches
// double-quoted data-placeholder. Safe today because the only writer
// (updateGhost/clearGhost via el.setAttribute) always serializes attributes
// double-quoted on innerHTML read, but pinned here so a future writer that
// emits single-quoted markup doesn't silently leak the attribute unnoticed.
test('cleanForSave: single-quoted data-placeholder is left unstripped (documented limitation)', () => {
  const html = "<div data-placeholder='ghost'>x</div>";
  assert.equal(cleanForSave(html), html);
});

// The reason the text-content cases above are safe in practice, pinned: a
// user typing literal markup into the contenteditable gets it HTML-escaped on
// innerHTML read, so there is no `<` for the tag regex to latch onto at all.
test('cleanForSave: escaped markup in text content is untouched', () => {
  const html = '<p>&lt;div data-placeholder="x"&gt; is the ghost hook</p>';
  assert.equal(cleanForSave(html), html);
});

test('wordCountOf: counts whitespace-separated words', () => {
  assert.equal(wordCountOf(''), 0);
  assert.equal(wordCountOf(null), 0);
  assert.equal(wordCountOf(undefined), 0);
  assert.equal(wordCountOf('   '), 0);
  assert.equal(wordCountOf('hi'), 1);
  assert.equal(wordCountOf('hello world'), 2);
  assert.equal(wordCountOf('a   b\n c'), 3);
  assert.equal(wordCountOf('  leading and trailing  '), 3);
});

// Callsite contract: updateWordCount() passes editor.innerText, which renders
// block boundaries as \n. wordCountOf must split on those — otherwise typing
// "hello\nworld" in the editor would count as 1 word, not 2.
test('wordCountOf: newline-separated blocks count separately', () => {
  assert.equal(wordCountOf('hello\nworld'), 2);
  assert.equal(wordCountOf('hello\n\nworld'), 2);
  assert.equal(wordCountOf('line one\nline two\nline three'), 6);
});

test('readHintFromEl: trims and caps to max', () => {
  assert.equal(readHintFromEl(null), '');
  assert.equal(readHintFromEl(undefined), '');
  assert.equal(readHintFromEl({}), '');
  assert.equal(readHintFromEl({ textContent: '' }), '');
  assert.equal(readHintFromEl({ textContent: '  hello  ' }), 'hello');
  // Default cap is 120.
  const long = 'x'.repeat(200);
  assert.equal(readHintFromEl({ textContent: long }).length, 120);
  // Custom cap.
  assert.equal(readHintFromEl({ textContent: 'abcdef' }, 3), 'abc');
});

// Regression: .slice(0, max) cuts by UTF-16 code unit, which can land inside
// a surrogate pair (e.g. an emoji is 2 code units) and leave a dangling lone
// high surrogate — an invalid string that can render as U+FFFD or break
// downstream JSON/encryption in pushCloud.
test('readHintFromEl: does not emit a malformed surrogate pair when truncating at max', () => {
  const emojis = '😀'.repeat(70); // 140 UTF-16 units
  for (let max = 115; max <= 125; max++) {
    const r = readHintFromEl({ textContent: emojis }, max);
    const last = r.charCodeAt(r.length - 1);
    assert.ok(!(last >= 0xd800 && last <= 0xdbff), `lone high surrogate at max=${max}`);
  }
  // Mixed ASCII + emoji, where the cutoff can land mid-pair even at the
  // default max.
  const mixed = 'hi ' + '😀'.repeat(60);
  const r = readHintFromEl({ textContent: mixed });
  const last = r.charCodeAt(r.length - 1);
  assert.ok(!(last >= 0xd800 && last <= 0xdbff));
});

test('swipeIntent: horizontal dominant swipes flip pages', () => {
  // Right swipe (positive dx) → previous page.
  assert.equal(swipeIntent(80, 0), 'prev');
  // Left swipe (negative dx) → next page.
  assert.equal(swipeIntent(-80, 0), 'next');
  // Right swipe with mild vertical drift still counts.
  assert.equal(swipeIntent(80, 20), 'prev');
});

test('swipeIntent: vertical-dominant or under-threshold = no nav', () => {
  // Vertical dominates → ignore.
  assert.equal(swipeIntent(80, 100), null);
  assert.equal(swipeIntent(-60, 80), null);
  // Tied magnitudes → ignore (favor scrolling).
  assert.equal(swipeIntent(60, 60), null);
  // Under threshold.
  assert.equal(swipeIntent(40, 0), null);
  assert.equal(swipeIntent(-40, 0), null);
  // No motion.
  assert.equal(swipeIntent(0, 0), null);
});

test('swipeIntent: custom threshold', () => {
  assert.equal(swipeIntent(40, 0, 30), 'prev');
  assert.equal(swipeIntent(40, 0, 50), null);
});

test('swipeIntent: exactly at threshold counts (only strictly-under is excluded)', () => {
  assert.equal(swipeIntent(50, 0, 50), 'prev');
  assert.equal(swipeIntent(-50, 0, 50), 'next');
});

test('htmlIsBlank: nothing at all is blank', () => {
  assert.equal(htmlIsBlank(''), true);
  assert.equal(htmlIsBlank('   '), true);
  assert.equal(htmlIsBlank('\n\t '), true);
  assert.equal(htmlIsBlank(null), true);
  assert.equal(htmlIsBlank(undefined), true);
});

// The whole point of the helper: contenteditable does not leave a page at ''
// once it has been touched. Focus a page, type, delete it all, and the browser
// leaves <br> / <div><br></div> behind — the markup every real "blank page"
// is actually made of.
test('htmlIsBlank: browser-inserted empty-line markup is blank', () => {
  assert.equal(htmlIsBlank('<br>'), true);
  assert.equal(htmlIsBlank('<br/>'), true);
  assert.equal(htmlIsBlank('<div><br></div>'), true);
  assert.equal(htmlIsBlank('<div><br></div><div><br></div>'), true);
  assert.equal(htmlIsBlank('<div><div><br></div></div>'), true);
  assert.equal(htmlIsBlank('<p></p>'), true);
  assert.equal(htmlIsBlank('<div class="x" data-placeholder="ghost"><br></div>'), true);
});

test('htmlIsBlank: non-breaking space and comments are blank', () => {
  assert.equal(htmlIsBlank('&nbsp;'), true);
  assert.equal(htmlIsBlank('&#160;'), true);
  assert.equal(htmlIsBlank('&#xA0;'), true);
  assert.equal(htmlIsBlank('\u00a0'), true);
  assert.equal(htmlIsBlank('<div>&nbsp;</div>'), true);
  assert.equal(htmlIsBlank('<!-- just a comment -->'), true);
});

test('htmlIsBlank: any real text is not blank', () => {
  assert.equal(htmlIsBlank('a'), false);
  assert.equal(htmlIsBlank('<p>hi</p>'), false);
  assert.equal(htmlIsBlank('<div><br></div><div>x</div>'), false);
  // A single visible character behind an entity still counts.
  assert.equal(htmlIsBlank('<div>&amp;</div>'), false);
});

// Embedded content has no text of its own. Treating "no text" as "blank"
// would let pruneEmptyPages silently delete a page holding a pasted image.
test('htmlIsBlank: embedded content is not blank even with no text', () => {
  assert.equal(htmlIsBlank('<img src="x.png">'), false);
  assert.equal(htmlIsBlank('<div><img src="x.png"></div>'), false);
  assert.equal(htmlIsBlank('<table><tr><td></td></tr></table>'), false);
  assert.equal(htmlIsBlank('<hr>'), false);
  assert.equal(htmlIsBlank('<iframe src="x"></iframe>'), false);
});

// Same trap cleanForSave hit twice: a `>` inside a quoted attribute value must
// not end the tag early, or the tag's own text leaks into the blankness check
// and an empty page reads as non-blank forever.
test('htmlIsBlank: > inside a quoted attribute value does not leak into the text', () => {
  assert.equal(htmlIsBlank('<div title="1 > 2"><br></div>'), true);
  assert.equal(htmlIsBlank("<div title='1 > 2'><br></div>"), true);
  assert.equal(htmlIsBlank('<div title="1 > 2">x</div>'), false);
});

test('pruneEmptyPages: keeps page 1 even when blank', () => {
  assert.deepEqual(pruneEmptyPages({ 1: '' }, 1), { 1: '' });
  assert.deepEqual(pruneEmptyPages({ 1: '  ' }, 5), { 1: '  ' });
});

// Regression: nextPage()'s "create a new page" branch does
// pages[newPage] = ''; savePage(); loadPage(newPage) — the freshly created
// page is blank by construction. The old inline prune ran before currentPage
// was updated and deleted that same page, leaving prevBtn permanently
// disabled and pageInfo showing the wrong page count until the user typed
// something. keepPage must survive the sweep even though it's empty.
test('pruneEmptyPages: keeps keepPage even when blank', () => {
  assert.deepEqual(
    pruneEmptyPages({ 1: 'hello', 2: '' }, 2),
    { 1: 'hello', 2: '' }
  );
});

test('pruneEmptyPages: deletes a different blank page that is not keepPage', () => {
  assert.deepEqual(
    pruneEmptyPages({ 1: 'hello', 2: '', 3: 'world' }, 3),
    { 1: 'hello', 3: 'world' }
  );
  // Whitespace-only content counts as blank too.
  assert.deepEqual(
    pruneEmptyPages({ 1: 'a', 2: '   ' }, 1),
    { 1: 'a' }
  );
});

test('pruneEmptyPages: leaves non-blank pages untouched', () => {
  assert.deepEqual(
    pruneEmptyPages({ 1: 'a', 2: 'b', 3: 'c' }, 1),
    { 1: 'a', 2: 'b', 3: 'c' }
  );
});

test('pruneEmptyPages: does not mutate the input object', () => {
  const input = { 1: 'a', 2: '' };
  const result = pruneEmptyPages(input, 1);
  assert.deepEqual(input, { 1: 'a', 2: '' });
  assert.notEqual(result, input);
});

test('pruneEmptyPages: keepPage is compared as a Number even if passed as a string', () => {
  assert.deepEqual(pruneEmptyPages({ 1: 'a', 2: '' }, '2'), { 1: 'a', 2: '' });
});

test('pruneEmptyPages: prunes multiple blank pages in one call', () => {
  assert.deepEqual(
    pruneEmptyPages({ 1: 'a', 2: '', 3: '', 4: 'd' }, 4),
    { 1: 'a', 4: 'd' }
  );
});

// Regression: the blankness check used to be `pages[p].trim() === ''` on an
// HTML string, so only a page literally equal to '' ever got pruned. Every
// page the user had actually visited held browser-inserted markup by then
// (<br>, <div><br></div>, &nbsp;) and survived the sweep forever — inflating
// the footer page count and the encrypted cloud blob with empty pages.
test('pruneEmptyPages: prunes a page holding only browser-inserted empty markup', () => {
  assert.deepEqual(pruneEmptyPages({ 1: 'a', 2: '<br>', 3: 'c' }, 3), { 1: 'a', 3: 'c' });
  assert.deepEqual(pruneEmptyPages({ 1: 'a', 2: '<div><br></div>' }, 1), { 1: 'a' });
  assert.deepEqual(pruneEmptyPages({ 1: 'a', 2: '&nbsp;' }, 1), { 1: 'a' });
  assert.deepEqual(pruneEmptyPages({ 1: 'a', 2: '<p></p>' }, 1), { 1: 'a' });
});

// The other side of that fix: never delete a page whose only content is
// embedded — a pasted image has no text but is the user's content.
test('pruneEmptyPages: keeps a page whose only content is an image', () => {
  const pages = { 1: 'a', 2: '<img src="x.png">' };
  assert.deepEqual(pruneEmptyPages(pages, 1), pages);
});

// Regression: reloadEditor() used `if (!pages[currentPage])` to detect a
// missing page, but '' is also falsy — so a legitimately existing blank page
// (e.g. a new page created and synced before anything was typed on it) was
// mistaken for a missing one and currentPage silently jumped back to the
// lowest existing page number.
test('resolveCurrentPage: returns currentPage unchanged when its content is blank', () => {
  assert.equal(resolveCurrentPage({ 1: 'hello', 2: '' }, 2), 2);
});

test('resolveCurrentPage: returns currentPage unchanged when it holds real content', () => {
  assert.equal(resolveCurrentPage({ 1: 'hello', 2: 'world' }, 2), 2);
});

test('resolveCurrentPage: falls back to the lowest page number when the key is absent', () => {
  assert.equal(resolveCurrentPage({ 1: 'a', 3: 'c' }, 7), 1);
  assert.equal(resolveCurrentPage({ 2: 'b', 5: 'e' }, 7), 2);
});

test('resolveCurrentPage: falls back to 1 when pages is empty', () => {
  assert.equal(resolveCurrentPage({}, 3), 1);
});

test('resolveCurrentPage: does not treat page 0 as absent', () => {
  assert.equal(resolveCurrentPage({ 0: 'orphaned content' }, 5), 0);
});

// Every consumer of the returned value does nums.indexOf(currentPage) against
// Object.keys(pages).map(Number), so a string key would miss (-1) and leave
// the footer and prev button describing a different page than the editor.
test('resolveCurrentPage: always returns a Number, even for a string key', () => {
  const r = resolveCurrentPage({ 1: 'a', 2: 'b' }, '2');
  assert.equal(r, 2);
  assert.equal(typeof r, 'number');
});

test('pageLabel: a contiguous book labels position as the page number', () => {
  assert.deepEqual(pageLabel({ 1: 'a', 2: 'b', 3: 'c' }, 1), { position: 1, total: 3, isFirst: true });
  assert.deepEqual(pageLabel({ 1: 'a', 2: 'b', 3: 'c' }, 2), { position: 2, total: 3, isFirst: false });
  assert.deepEqual(pageLabel({ 1: 'a', 2: 'b', 3: 'c' }, 3), { position: 3, total: 3, isFirst: false });
});

// Regression: the footer was `${currentPage} / ${nums.length}` — a page KEY
// over a page COUNT. pruneEmptyPages leaves gaps in the numbering, so after
// (write pages 1-3 → back to page 2 → Clear → Next) the keys are {1, 3} and
// the footer read "3 / 2".
test('pageLabel: gapped page numbering still labels position over total', () => {
  assert.deepEqual(pageLabel({ 1: 'a', 3: 'c' }, 3), { position: 2, total: 2, isFirst: false });
  assert.deepEqual(pageLabel({ 1: 'a', 3: 'c' }, 1), { position: 1, total: 2, isFirst: true });
  assert.deepEqual(pageLabel({ 2: 'b', 7: 'g', 9: 'i' }, 9), { position: 3, total: 3, isFirst: false });
});

// isFirst drives prevBtn.disabled — it must key off the LOWEST existing page,
// not page 1, since page 1 can be absent from synced state.
test('pageLabel: isFirst tracks the lowest existing page, not page 1', () => {
  assert.equal(pageLabel({ 4: 'd', 5: 'e' }, 4).isFirst, true);
  assert.equal(pageLabel({ 4: 'd', 5: 'e' }, 5).isFirst, false);
});

test('pageLabel: a string currentPage resolves to the same position', () => {
  assert.deepEqual(pageLabel({ 1: 'a', 3: 'c' }, '3'), { position: 2, total: 2, isFirst: false });
});

// Degenerate states must never render "0 / 0" in the footer.
test('pageLabel: empty pages and absent keys fall back to 1 / 1', () => {
  assert.deepEqual(pageLabel({}, 1), { position: 1, total: 1, isFirst: true });
  assert.deepEqual(pageLabel({ 1: 'a' }, 9), { position: 1, total: 1, isFirst: true });
});

// Invariant: every POOL category must yield a non-empty pick/pool for every
// (hour, day) combination aiContext() can produce. Catches regressions where
// a tagged-only category lacks an untagged fallback — pickByContext would
// throw 'empty pool' at unlock time on the days that don't match.
test('POOL: every aiContext combination resolves for every category', () => {
  const categories = Object.keys(POOL);
  assert.ok(categories.length > 0, 'POOL must have categories');
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const ctx = aiContext(new Date(2026, 4, 3 + day, hour, 0, 0, 0));
      assert.equal(ctx.length, 2, `aiContext should yield 2 tags for d=${day} h=${hour}`);
      for (const cat of categories) {
        const line = pickByContext(POOL[cat], ctx, () => 0);
        assert.ok(typeof line === 'string' && line.length > 0,
          `pickByContext(${cat}) empty for ctx=${ctx}`);
        const pool = poolByContext(POOL[cat], ctx);
        assert.ok(pool.length > 0,
          `poolByContext(${cat}) empty for ctx=${ctx}`);
        for (const l of pool) {
          assert.ok(typeof l === 'string' && l.length > 0,
            `poolByContext(${cat}) has empty/non-string entry for ctx=${ctx}`);
        }
      }
    }
  }
});
