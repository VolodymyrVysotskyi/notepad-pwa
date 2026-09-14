import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiContext, pickByContext, poolByContext,
  cleanForSave, wordCountOf, readHintFromEl, swipeIntent,
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

test('wordCountOf: counts whitespace-separated words', () => {
  assert.equal(wordCountOf(''), 0);
  assert.equal(wordCountOf(null), 0);
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
