import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiContext } from '../lib.mjs';
import { POOL } from '../pool.mjs';

// Build the set of tags aiContext() can actually produce by walking every
// hour-of-day × day-of-week combination. Any POOL entry tagged with a string
// outside this set is dead code — pickByContext() will never select it.
const validTags = (() => {
  const set = new Set();
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      for (const t of aiContext(new Date(2026, 4, 3 + day, hour, 0, 0, 0))) {
        set.add(t);
      }
    }
  }
  return set;
})();

test('POOL: every tag is producible by aiContext', () => {
  for (const [cat, entries] of Object.entries(POOL)) {
    for (const entry of entries) {
      for (const tag of entry.tags) {
        assert.ok(validTags.has(tag),
          `POOL.${cat}: tag '${tag}' on line "${entry.line}" is not producible by aiContext — typo or stale tag`);
      }
    }
  }
});

// Direct guard for the unlock-must-not-crash contract. The 24×7 walk in
// lib.test.mjs catches missing fallbacks transitively; this one points
// straight at the offending category.
test('POOL: every category has at least one untagged fallback', () => {
  for (const [cat, entries] of Object.entries(POOL)) {
    assert.ok(entries.some(e => e.tags.length === 0),
      `POOL.${cat} needs an untagged fallback or pickByContext throws on non-matching contexts`);
  }
});
