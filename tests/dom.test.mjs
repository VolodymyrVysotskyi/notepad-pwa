// Behavioural tests for the DOM-coupled logic that lives in index.html's
// inline <script type="module">. These run the REAL script — see the header of
// tests/harness.mjs for how, and for the explicit list of browser behaviours
// the stub DOM cannot model. Anything cascade- or layout-shaped belongs in
// tests/markup.test.mjs instead; nothing here may claim a rendering outcome.
//
// Every `<br>` / `<div><br></div>` fixture below is a STATED ASSUMPTION about
// what a browser leaves in a contenteditable, not something the stub observed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const PHRASE = 'harness test phrase';

// PBKDF2 at 100k iterations costs ~70ms. Derive once; CryptoKey objects are
// process-global and interoperate across module instances, so every test that
// doesn't need the real enter() path injects this instead of paying again.
let KEY, PID;
test('bootstrap: derive one key for the whole file', async () => {
  const inst = await loadApp();
  KEY = await inst.internals.deriveKey(PHRASE);
  PID = await inst.internals.deriveId(PHRASE);
  assert.ok(KEY && typeof PID === 'string' && PID.length === 64);
  inst.dispose();
});

// A signed-in instance without the PBKDF2 cost.
async function app(opts = {}) {
  const inst = await loadApp(opts);
  inst.internals.cryptoKey = KEY;
  inst.internals.phraseId = PID;
  inst.ids.phraseScreen.hidden = true;
  inst.ids.appHeader.hidden = false;
  inst.ids.appContainer.hidden = false;
  inst.ids.appFooter.hidden = false;
  return inst;
}

const decrypt = (inst, row) => inst.internals.decryptJSON(KEY, row.encrypted);

// Real (unshadowed) timers — only the module under test gets the fake clock.
// Needed where a flush is fire-and-forget and awaits real WebCrypto, which
// goes through the threadpool rather than resolving as a microtask.
async function until(predicate, label, ms = 2000) {
  const t0 = Date.now();
  while (!predicate()) {
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for: ${label}`);
    await new Promise(r => setTimeout(r, 5));
  }
}

// ---------------------------------------------------------------------------
// Sanity. These exist so the defect tests below cannot pass vacuously: if the
// wiring moves or the stub stops modelling what the code reads, these fail
// first and loudly instead of every behavioural test quietly asserting nothing.
// ---------------------------------------------------------------------------

test('sanity: the listener wiring is exactly what the tests drive', async () => {
  const inst = await app();
  assert.deepEqual(inst.listenerInventory(), [
    'clearBtn/click',
    'document/keydown',
    'document/selectionchange',
    'document/visibilitychange',
    'editor/blur',
    'editor/focus',
    'editor/input',
    'editor/touchend',
    'editor/touchstart',
    'hint/input',
    'hint/keydown',
    'hint/paste',
    'nextBtn/click',
    'phraseForm/submit',
    'phraseToggle/click',
    'prevBtn/click',
    'switchBtn/click',
    'window/online',
    'window/pagehide',
  ]);
  inst.dispose();
});

test('sanity: the stub editor models the markup the ghost/word-count code reads', async () => {
  const inst = await app();
  const e = inst.ids.editor;
  const shape = (html) => {
    e.innerHTML = html;
    assert.deepEqual(e.parseWarnings, [], `stub could not parse ${html}`);
    return { children: e.children.map(c => c.tagName), text: e.textContent, innerText: e.innerText };
  };
  assert.deepEqual(shape(''), { children: [], text: '', innerText: '' });
  assert.deepEqual(shape('<br>'), { children: ['BR'], text: '', innerText: '\n' });
  assert.deepEqual(shape('hello'), { children: [], text: 'hello', innerText: 'hello' });
  assert.deepEqual(shape('<div>x</div><div>y</div>'),
    { children: ['DIV', 'DIV'], text: 'xy', innerText: 'x\ny' });
  inst.dispose();
});

test('sanity: the v3/v4 localStorage keys are purged at load', async () => {
  const inst = await loadApp();
  assert.deepEqual(inst.storage.local.removed.sort(), [
    'notepad-data', 'notepad-dirty', 'notepad-id', 'notepad-last-page', 'notepad-pages',
  ]);
  inst.dispose();
});

test('sanity: a full unlock restores cloud state into the chrome', async () => {
  const seed = await loadApp();
  const stored = {
    encrypted: await seed.internals.encryptJSON(KEY, {
      pages: { 1: '<div>restored</div>' }, currentPage: 1, hint: 'my notepad',
    }),
  };
  seed.dispose();

  const inst = await loadApp({ stored });
  await inst.internals.enter(PHRASE);
  assert.equal(inst.internals.phraseId, PID);
  assert.deepEqual(inst.internals.pages, { 1: '<div>restored</div>' });
  assert.equal(inst.ids.editor.innerHTML, '<div>restored</div>');
  assert.equal(inst.ids.hintEl.textContent, 'my notepad');
  assert.equal(inst.ids.pageInfo.textContent, '1 / 1');
  assert.equal(inst.ids.phraseScreen.hidden, true);
  assert.equal(inst.ids.appHeader.hidden, false);
  assert.equal(inst.ids.phraseError.textContent, '');
  inst.dispose();
});

// ---------------------------------------------------------------------------
// D1 — the half of the 2026-05-06 fix that was never made.
// ---------------------------------------------------------------------------

// `editor` and `hintEl` used to share one `autoSaveTimer`. The 2026-05-06 pass
// fixed the hint direction (pushCloud reads the hint from the DOM at push
// time) and left the mirror image open: a hint edit within 1s of an editor
// edit ran clearTimeout on the pending savePage(), and savePage is the ONLY
// place editor.innerHTML reaches `pages`. The upload then carried the new hint
// and the previous page content — actively overwriting the good cloud copy.
test('a hint edit within 1s of an editor edit does not drop the typed text', async () => {
  const inst = await app();
  inst.type(inst.ids.editor, 'the paragraph I just wrote');   // t=0
  await inst.clock.tick(500);

  inst.ids.hintEl.textContent = 'my hint';
  inst.mustFire(inst.ids.hintEl, 'input');                    // t=500
  await inst.clock.tick(1000);                                // saveHint
  await inst.clock.tick(1000);                                // pushCloud

  assert.equal(inst.supabase.upserts.length, 1, 'expected exactly one upload');
  const payload = await decrypt(inst, inst.supabase.lastUpsert);
  assert.equal(payload.hint, 'my hint');
  assert.equal(payload.pages[1], 'the paragraph I just wrote');
  assert.equal(inst.internals.pages[1], 'the paragraph I just wrote');
  inst.dispose();
});

// The other reason the timers are split. Once the editor's autosave stopped
// restarting on every keystroke (below), a shared timer became actively worse:
// the hint handler's clearTimeout would leave the editor's timer variable
// pointing at the hint's timer, which nothing ever resets to null — so the
// editor would take its "a save is already pending" branch forever and never
// queue another push. Only a later hint edit or a page flip would sync again.
test('editing the hint does not disable the editor autosave', async () => {
  const inst = await app();
  inst.type(inst.ids.editor, 'first');
  await inst.clock.tick(100);
  inst.ids.hintEl.textContent = 'h';
  inst.mustFire(inst.ids.hintEl, 'input');
  await inst.clock.tick(3000);
  const before = inst.supabase.upserts.length;

  inst.type(inst.ids.editor, 'first and second');
  await inst.clock.tick(3000);

  assert.ok(inst.supabase.upserts.length > before,
    'the editor stopped queueing saves after a hint edit');
  assert.equal((await decrypt(inst, inst.supabase.lastUpsert)).pages[1], 'first and second');
  inst.dispose();
});

// ---------------------------------------------------------------------------
// D2 — persistence timing. The cloud is the only copy (v5 removed every
// localStorage write), so an unsaved window is unrecoverable data loss.
// ---------------------------------------------------------------------------

test('typing without a 1s pause still reaches the cloud', async () => {
  const inst = await app();
  let text = '';
  for (let i = 0; i < 6; i++) {
    text += `word${i} `;
    inst.type(inst.ids.editor, text);
    await inst.clock.tick(900);   // never a full 1s gap
  }
  assert.ok(inst.supabase.upserts.length >= 1,
    '5.4s of continuous typing produced no upload at all');
  const payload = await decrypt(inst, inst.supabase.lastUpsert);
  assert.match(payload.pages[1], /^word0 /);
  inst.dispose();
});

// The other half: the existing debounce must survive the fix above. Typing
// then stopping still saves, and still only once.
test('typing then stopping saves exactly once', async () => {
  const inst = await app();
  inst.type(inst.ids.editor, 'done typing');
  await inst.clock.tick(3000);
  assert.equal(inst.supabase.upserts.length, 1);
  const payload = await decrypt(inst, inst.supabase.lastUpsert);
  assert.equal(payload.pages[1], 'done typing');
  inst.dispose();
});

// Backgrounding a PWA on iOS does not run timers. Without a flush the loss
// window is the full 1s autosave + 1s push debounce.
test('backgrounding the page flushes immediately, without waiting on timers', async () => {
  const inst = await app();
  inst.type(inst.ids.editor, 'unflushed sentence');
  await inst.clock.tick(300);
  assert.equal(inst.supabase.upserts.length, 0, 'precondition: nothing saved yet');

  assert.ok(inst.listenerCount(inst.document, 'visibilitychange') > 0,
    'no visibilitychange handler — nothing flushes when the app is backgrounded');
  inst.document.visibilityState = 'hidden';
  inst.fire(inst.document, 'visibilitychange');
  await until(() => inst.supabase.upserts.length === 1, 'the backgrounding flush');

  assert.equal(inst.clock.now, 300, 'the flush must not depend on advancing timers');
  const payload = await decrypt(inst, inst.supabase.lastUpsert);
  assert.equal(payload.pages[1], 'unflushed sentence');
  inst.dispose();
});

test('pagehide flushes too, for desktop unload', async () => {
  const inst = await app();
  inst.type(inst.ids.editor, 'closing the tab now');
  await inst.clock.tick(300);
  assert.ok(inst.listenerCount(inst.window, 'pagehide') > 0, 'no pagehide handler');
  inst.fire(inst.window, 'pagehide');
  await until(() => inst.supabase.upserts.length === 1, 'the pagehide flush');
  assert.equal((await decrypt(inst, inst.supabase.lastUpsert)).pages[1], 'closing the tab now');
  inst.dispose();
});

// ---------------------------------------------------------------------------
// D3 — Switch must not throw work away when the save failed.
// ---------------------------------------------------------------------------

// pushCloud swallows its errors into setSyncStatus(), so switchNotepad's
// `try { await pushCloud(); } catch {}` can never fire — the teardown below it
// ran unconditionally. Offline, tapping Switch destroyed the page. On the
// primary target the failure is invisible too: .sync-status is display:none
// under 768px (pinned in markup.test.mjs), so the warning cannot rely on it.
test('pushCloud reports failure instead of throwing', async () => {
  const inst = await app({ upsertError: { message: 'boom' } });
  const ok = await inst.internals.pushCloud();
  assert.equal(ok, false);
  assert.match(inst.ids.syncStatus.className, /error/);

  const inst2 = await app();
  assert.equal(await inst2.internals.pushCloud(), true);
  inst.dispose(); inst2.dispose();
});

test('switching notepads after a failed save keeps the work', async () => {
  const inst = await app({ upsertError: { message: 'boom' }, confirmResult: false });
  inst.type(inst.ids.editor, 'unsaved secret');
  await inst.clock.tick(2000);
  assert.match(inst.ids.syncStatus.className, /error/, 'precondition: the push failed');

  await inst.internals.switchNotepad();

  assert.equal(inst.calls.confirm.length, 1, 'the user was never warned');
  assert.notEqual(inst.internals.cryptoKey, null, 'locked out with the work unsaved');
  assert.equal(inst.internals.pages[1], 'unsaved secret');
  assert.equal(inst.ids.editor.innerHTML, 'unsaved secret');
  assert.equal(inst.ids.phraseScreen.hidden, true, 'should have stayed in the notepad');
  inst.dispose();
});

test('switching notepads after a failed save proceeds if the user insists', async () => {
  const inst = await app({ upsertError: { message: 'boom' }, confirmResult: true });
  inst.type(inst.ids.editor, 'give up on it');
  await inst.clock.tick(2000);
  await inst.internals.switchNotepad();
  assert.equal(inst.calls.confirm.length, 1);
  assert.equal(inst.internals.cryptoKey, null);
  assert.equal(inst.ids.phraseScreen.hidden, false);
  inst.dispose();
});

// ---------------------------------------------------------------------------
// D4 — "one phrase locks everything" has to mean the DOM too.
// ---------------------------------------------------------------------------

test('switching notepads leaves no plaintext behind in the editor', async () => {
  const inst = await app();
  inst.ids.hintEl.textContent = 'work stuff';
  inst.type(inst.ids.editor, 'my private note');
  await inst.clock.tick(2000);
  assert.equal(inst.supabase.upserts.length, 1, 'precondition: saved cleanly');

  await inst.internals.switchNotepad();

  assert.equal(inst.calls.confirm.length, 0, 'a clean save must not prompt');
  assert.equal(inst.ids.editor.innerHTML, '', 'previous notepad still readable in the DOM');
  assert.equal(inst.ids.editor.textContent, '');
  assert.equal(inst.ids.hintEl.textContent, '');
  assert.equal(inst.ids.wordCount.textContent, '0 words');
  assert.equal(inst.ids.pageInfo.textContent, '1 / 1');
  inst.dispose();
});

// ---------------------------------------------------------------------------
// D5 — ghost placeholder. Assertions are strictly "data-placeholder is set";
// whether it paints is CSS, which this harness cannot see.
// ---------------------------------------------------------------------------

test('the ghost prompt comes back after clicking away from an empty editor', async () => {
  const inst = await app();
  inst.internals.firstPromptUsed = false;
  inst.ids.editor.innerHTML = '';
  inst.setSelection({ rangeCount: 0, anchorNode: null });

  inst.focus(inst.ids.editor);
  assert.equal(inst.ids.editor.getAttribute('data-placeholder'), inst.internals.AI.firstPrompt);

  inst.blur(inst.ids.editor);
  assert.equal(inst.ids.editor.getAttribute('data-placeholder'), inst.internals.AI.firstPrompt,
    'blur cleared the ghost and never restored the unfocused one');
  inst.dispose();
});

// Assumption: typing `hello` with no Enter puts a bare text node in the
// editor, and select-all + delete leaves Chrome's single <br> behind. The old
// `editor.children.length === 0` guard reads that as "has content", so the
// page looked empty with no prompt for the rest of the session.
test('the ghost prompt survives the <br> a browser leaves in an emptied editor', async () => {
  const inst = await app();
  inst.internals.firstPromptUsed = false;
  inst.ids.editor.innerHTML = '<br>';

  inst.setSelection({ anchorNode: inst.ids.editor });
  inst.focus(inst.ids.editor);
  assert.ok(inst.ids.editor.getAttribute('data-placeholder'), 'no ghost while focused');

  inst.blur(inst.ids.editor);
  inst.internals.updateGhost();
  assert.ok(inst.ids.editor.getAttribute('data-placeholder'), 'no ghost while unfocused');
  inst.dispose();
});

test('the ghost lands on the empty block at the cursor, indexed by line', async () => {
  const inst = await app();
  inst.internals.firstPromptUsed = true;
  inst.ids.editor.innerHTML = '<div>x</div><div></div>';
  const second = inst.ids.editor.children[1];
  inst.setSelection({ anchorNode: second });
  inst.focus(inst.ids.editor);

  const pool = inst.internals.AI.rowPlaceholders;
  assert.equal(second.getAttribute('data-placeholder'), pool[1 % pool.length]);
  assert.equal(inst.ids.editor.children[0].getAttribute('data-placeholder'), null);
  inst.dispose();
});

// ---------------------------------------------------------------------------
// D6 — integration guard. lib.test.mjs covers pageLabel in isolation; nothing
// proved updateUI still CALLS it rather than reverting to the old
// `${currentPage} / ${nums.length}`, which rendered "3 / 2" for pages {1, 3}.
// ---------------------------------------------------------------------------

test('the footer reads position over total after a mid-book page is pruned', async () => {
  const inst = await app({ confirmResult: true });
  const { editor, nextBtn, prevBtn, clearBtn, pageInfo } = inst.ids;

  inst.type(editor, 'a'); await inst.clock.tick(1000);
  inst.mustFire(nextBtn, 'click');
  inst.type(editor, 'b'); await inst.clock.tick(1000);
  inst.mustFire(nextBtn, 'click');
  inst.type(editor, 'c'); await inst.clock.tick(1000);
  inst.mustFire(prevBtn, 'click');
  assert.equal(pageInfo.textContent, '2 / 3');

  inst.mustFire(clearBtn, 'click');
  assert.equal(inst.calls.confirm.length, 1, 'Clear was skipped, so the prune never happened');
  inst.mustFire(nextBtn, 'click');

  assert.deepEqual(Object.keys(inst.internals.pages).map(Number).sort((a, b) => a - b), [1, 3]);
  assert.equal(inst.internals.currentPage, 3);
  assert.equal(pageInfo.textContent, '2 / 2');
  assert.equal(prevBtn.disabled, false);
  inst.dispose();
});

test('Clear is a silent no-op on a page that only holds browser residue', async () => {
  const inst = await app({ confirmResult: true });
  inst.ids.editor.innerHTML = '<div><br></div>';
  inst.mustFire(inst.ids.clearBtn, 'click');
  assert.equal(inst.calls.confirm.length, 0, 'prompted "No undo." with nothing to wipe');
  inst.dispose();
});
