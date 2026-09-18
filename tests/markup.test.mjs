// Source-level invariants over index.html. These are deliberately NOT
// behavioural: they cover the things tests/harness.mjs explicitly cannot model
// (the CSS cascade) and the things only production can otherwise catch (the
// markers the post-merge smoke workflow greps against the live site).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');

const STYLE = HTML.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
const SCRIPT = HTML.match(/<script type="module">\n([\s\S]*?)<\/script>/)[1];

// Flat `selector { body }` rules. A @media block's own header never matches
// (its body contains braces), but the rules nested inside it do — which is
// exactly the granularity we want.
function rules() {
  return [...STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
    selectors: sel.split(',').map(s => s.trim()).filter(Boolean),
    body,
  }));
}

// Which elements does the script actually hide, and what do they look like?
function toggledElements() {
  const ids = new Map();          // variable name -> element id
  for (const m of SCRIPT.matchAll(/const (\w+) = document\.getElementById\('(\w+)'\)/g)) {
    ids.set(m[1], m[2]);
  }
  const out = [];
  for (const v of new Set([...SCRIPT.matchAll(/(\w+)\.hidden\s*=/g)].map(m => m[1]))) {
    const id = ids.get(v);
    assert.ok(id, `'${v}.hidden' is assigned but ${v} is not a getElementById binding`);
    const tag = HTML.match(new RegExp(`<(\\w+)([^>]*\\bid="${id}"[^>]*)>`));
    assert.ok(tag, `no element with id="${id}" in the markup`);
    const cls = (tag[2].match(/class="([^"]*)"/) || [, ''])[1];
    const keys = [tag[1].toLowerCase(), ...cls.split(/\s+/).filter(Boolean).map(c => `.${c}`)];
    out.push({ id, keys });
  }
  return out;
}

// Regression, 2026-09-18. `header { display: flex }` and `footer { display:
// flex }` are AUTHOR rules; the UA stylesheet's `[hidden] { display: none }`
// is a UA rule, and author origin wins regardless of specificity. So
// `appHeader.hidden = true` did nothing: on the lock screen Tab still walked
// into the contenteditable hint and the Clear / Prev / Next buttons, and
// screen readers still announced the whole app chrome. It only LOOKED right
// because .phrase-screen is fixed/inset-0/z-10 with an opaque background and
// painted over it. `.phrase-screen[hidden]` already existed for exactly this
// reason — the same fix was never applied to the chrome.
test('every element the script hides actually hides', () => {
  const all = rules();
  const setsDisplay = new Set();   // selectors that give an element a display
  const guards = new Set();        // selectors that restore display:none for [hidden]
  for (const r of all) {
    const decl = r.body.match(/(?:^|;)\s*display\s*:\s*([^;]+)/);
    if (!decl) continue;
    const none = decl[1].trim().startsWith('none');
    for (const s of r.selectors) (none ? guards : setsDisplay).add(s);
  }

  const targets = toggledElements();
  assert.ok(targets.length >= 4, `expected the script to hide several elements, found ${targets.length}`);

  for (const { id, keys } of targets) {
    for (const key of keys) {
      if (!setsDisplay.has(key)) continue;   // UA [hidden] is unopposed — fine
      assert.ok(
        guards.has(`${key}[hidden]`),
        `#${id}: '${key}' sets display, so the UA's [hidden] rule loses to it. ` +
        `Add '${key}[hidden] { display: none; }' or the element will never hide.`
      );
    }
  }
});

// .github/workflows/post-merge-smoke.yml greps these against the deployed
// site. Pinning them here means a rename fails in PR CI instead of after
// merge, against production.
test('the markers the post-merge smoke test greps for are present', () => {
  for (const marker of ['id="phraseInput"', '.phrase-screen[hidden]', 'createClient']) {
    assert.ok(HTML.includes(marker),
      `post-merge-smoke.yml greps for ${marker} in production — keep it or update the workflow`);
  }
});

// Documentation, not a rendering assertion (this file has no CSS engine
// either). The sync chip is intentionally hidden on the primary target, so
// anything that has to reach the user on a phone — a failed save, most of all
// — must not rely on setSyncStatus alone. switchNotepad's confirm() is the
// standing example.
test('the sync status chip stays hidden on mobile', () => {
  const mobile = STYLE.slice(STYLE.indexOf('@media (max-width: 768px)'));
  assert.ok(/\.sync-status\s*\{[^}]*display:\s*none/.test(mobile),
    'if .sync-status becomes visible on mobile, revisit how sync errors are surfaced');
  assert.ok(/confirm\(/.test(SCRIPT.slice(SCRIPT.indexOf('async function switchNotepad'))),
    'switchNotepad must warn through a dialog, not the mobile-hidden status chip');
});
