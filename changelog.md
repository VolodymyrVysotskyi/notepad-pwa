# Changelog

Notable changes to the notepad. Newest first.

---

## 2026-09-17 — Page bookkeeping: footer label, blank-page pruning, `clearPage` guard

Daily review pass over the previous pass's uncommitted page-management extraction. Three real defects, all in blankness/position bookkeeping; the extraction itself is recorded here for the first time.

- **Footer showed a page number over a page count.** `updateUI()` rendered `` `${currentPage} / ${nums.length}` `` — a page *key* divided by a page *count*. Those agree only while the numbering is contiguous, and `pruneEmptyPages` puts gaps in it by design. Repro, no sync or dev tools needed: write on pages 1–3 → back to page 2 → **Clear** → **Next**. Page 2 gets pruned, the keys become `{1, 3}`, and the footer read **"3 / 2"**. Fix: new `pageLabel(pages, currentPage)` derives `{position, total, isFirst}` from the sorted key list via `indexOf` — the same calculation `prevBtn.disabled` already trusted, now the single source for both. For a contiguous book `position === currentPage`, so nothing changes in the normal case.
- **`pruneEmptyPages` never pruned the blank pages users actually create.** The blankness test was `pages[p].trim() === ''` against an *HTML string*, so only a page literally equal to `''` qualified. Any page the user had focused and typed-then-emptied held browser-inserted markup by then — `<br>`, `<div><br></div>`, `&nbsp;` — all of which `.trim()` reports as content. The helper's entire purpose therefore failed for the common case: abandoned blank pages accumulated in the book, in the footer count, and in the encrypted cloud blob, permanently. Fix: new `htmlIsBlank(html)` strips comments and tags (reusing `cleanForSave`'s quote-aware tag pattern, now hoisted to one shared const so the two can't drift), normalizes `&nbsp;`/U+00A0, and checks what's left. Embedded content (`img`, `video`, `table`, `hr`, …) short-circuits to non-blank so a page holding only a pasted image is never deleted for having no text. Anything unparseable leaves residue and reads as non-blank — the conservative outcome is always "keep the page".
- **`clearPage()` prompted "Wipe this page? No undo." on an empty page.** The guard was raw `editor.innerHTML` truthiness, and an active ghost placeholder or a leftover `<br>` makes that truthy on a page with nothing in it. Now gated on `htmlIsBlank()`, so Clear on an empty page is a silent no-op.
- **`resolveCurrentPage` now always returns a Number.** It returned `currentPage` verbatim on the hit path, so a string key (`pages['2']` exists) would flow into the `currentPage` state variable, where every consumer does `nums.indexOf(currentPage)` against `Object.keys().map(Number)` → `-1` → footer and prev button describing a different page than the editor. Unreachable from today's writers; one `Number()` closes it for good.
- **Recorded from the previous pass:** `pruneEmptyPages` / `resolveCurrentPage` extracted from inline `index.html` logic (the old inline prune deleted the freshly created page in `nextPage()`'s add-a-page branch, and `reloadEditor()`'s `if (!pages[currentPage])` mistook an existing blank page for a missing one), plus `readHintFromEl` no longer truncating mid-surrogate-pair and leaving a lone high surrogate in the hint.
- **Tests: 35 → 50.** New suites for `htmlIsBlank` (empty-line markup, `&nbsp;`, comments, embedded content, `>` inside a quoted attribute) and `pageLabel` (contiguous, gapped, `isFirst` off the lowest key, degenerate `{}`), plus the two regressions above and a `cleanForSave` test pinning that escaped markup in text content is untouched. Each new test was confirmed to fail against the pre-fix code and pass after.
- **`package.json` added** (private, zero dependencies) so `npm test` is the one canonical command. `lib.mjs`'s header documented `node --test tests/`, which current Node resolves as a module path and rejects; CI already used the glob.

## 2026-09-10 — cleanForSave quote-escape fix + hint-read dedup

Daily review pass. One real defect surviving the previous `cleanForSave` fix, one duplication cleanup.

- **`cleanForSave` still broke on `>` inside a quoted attribute value.** The 2026-05-19 fix scoped the strip to inside an opening tag using `[^>]*` for the attribute span, but that stops at the *first* `>` anywhere in the tag — including one inside a quoted value like `title="1 > 2"`. When that happens the tag never matches at all, so `data-placeholder` silently survives into the saved/encrypted note instead of being stripped. Reachable in practice: `data-placeholder` is set directly on the editor or the current empty block, and DOMPurify-sanitized pasted rich text can carry a `title`/similar attribute containing `>` on that same element. Fix: match quoted spans (`"[^"]*"` / `'[^']*'`) as a unit in the attrs group so `>` inside them can't end the tag early. New tests cover a `>`-bearing attribute before and after `data-placeholder`, and with single quotes.
- **Hint-read logic de-duplicated onto `readHintFromEl`.** `pushCloud()` was updated on 2026-05-06 to read the hint from the DOM via the new `readHintFromEl()` helper specifically so there'd be one trusted read path, but `switchNotepad()` and `saveHint()` still inlined the same `trim().slice(0, 120)` expression instead of calling it. No behavior change today, but it closes the gap the original fix was meant to close — a future change to the truncation length no longer has to be made in three places.

## 2026-05-19 — Word-count fix + pool invariant test + cleanForSave regex

Daily review pass. Two real defects, two preventative tests.

- **Word count under-counted multi-block content.** `updateWordCount()` read `editor.textContent`, which concatenates child blocks without separators — so `<div>hello</div><div>world</div>` collapsed to `"helloworld"` and the header showed **1 word** instead of 2. Fix: read `editor.innerText` so block boundaries become `\n`; the existing `wordCountOf` whitespace split handles the rest. Added an explicit newline-separated test case to `wordCountOf` to lock the callsite contract.
- **POOL extracted to `pool.mjs`, invariant pinned by test.** The `POOL` constants previously lived inside the `index.html` `<script>` block, so they could not be exercised from `node:test`. Moved to a sibling ES module imported by both the page and the test. New test walks all 24×7 hour/day combinations and asserts `pickByContext` and `poolByContext` return non-empty strings for every category — protects against a future edit that removes the only untagged fallback from a category and silently breaks unlock on the days that don't match the remaining tags.
- **`cleanForSave` regex no longer eats text.** The old flat regex stripped `data-placeholder="x"` from anywhere in the HTML, including text content — `<p>Use data-placeholder="hi" here</p>` collapsed to `<p>Use here</p>`, silently dropping a piece of the user's note (worst case: someone documenting HTML attributes loses that part on save). Tightening the leading whitespace from `\s*` to `\s+` wasn't enough — text content has whitespace before random tokens too. Replaced with a regex that scopes the strip to the inside of an opening tag, so attribute-position is the only place a match can land. New tests cover text-content protection (at the start of text and mid-text), idempotency, and first-attribute stripping.

## 2026-05-06 — Bug fixes + first unit-test harness

Daily review pass. Two real bugs fixed; pure helpers extracted into `lib.mjs` and covered by `node:test`.

- **Hint edits no longer silently lost.** `editor` and `hintEl` shared a single `autoSaveTimer`, so a hint edit followed within 1s by an editor edit cancelled the queued `saveHint()` and the in-memory `hint` variable stayed stale — the next `pushCloud()` then encrypted and uploaded the *prior* hint, overwriting the user's current hint in Supabase. Fix: `pushCloud()` now reads the hint from `hintEl.textContent` at upload time, treating the DOM as the source of truth so the shared debounce timer can no longer cause data loss.
- **Touch swipe ignores vertical motion.** Page-flip handler only inspected `clientX`, so a vertical scroll with >50 px of incidental horizontal drift would page-flip mid-scroll. Fix: track Y too, only trigger when `|dx| > |dy|` and `|dx| ≥ 50`. Encapsulated in a pure `swipeIntent(dx, dy)` helper so it has direct test coverage.
- **`lib.mjs` introduced.** Moved `aiContext`, `pickByContext`, `poolByContext`, `cleanForSave`, plus new `wordCountOf`, `readHintFromEl`, `swipeIntent` into a sibling module. `index.html` imports them; behavior unchanged. `pickByContext` now takes an optional `rng` arg so tests can pin selection.
- **`tests/lib.test.mjs` + `.github/workflows/tests.yml`.** Native `node:test` runner — no `package.json`, no devDependencies. CI runs on every push and PR. Covers the boundaries that bit us (hour-of-day, day-of-week, swipe direction/threshold) plus the helper invariants (cleanForSave idempotency, wordCountOf empty/null safety, readHintFromEl truncation).

## 2026-04-28 — Cache-resilient SW retirement

Users on stale v3/v4 PWA installs were still seeing pre-pivot HTML for one reload after each new deploy. Fixes the self-destructing SW and the HTML's legacy-cleanup so the app reaches a fresh state on the very next load — regardless of browser cache, SW cache, or PWA install state.

- **`sw.js`: `clients.claim()` on activate.** The new SW now takes over previously-controlled tabs immediately instead of waiting for them to release the old SW. Without this, `clients.matchAll().forEach(c => c.navigate(c.url))` was navigating tabs that were still attached to the old cache-first SW, which served the cached HTML again — defeating the whole self-destruct.
- **`sw.js`: network-only pass-through fetch handler.** Defends against the brief window between `claim()` and `unregister()` where this SW controls the page; every fetch goes straight to the network with `cache: 'no-store'`.
- **`index.html`: force one reload after unregistering legacy SW.** If the page we're rendering came from an old SW's cache, a single guarded reload (sessionStorage flag prevents loops) gets us bytes from the network. The cleanup is now an async IIFE that awaits each step in order: detect SWs → unregister → clear caches → reload.

### Why
v5 already retired the SW, but the migration assumed users would either reload twice or hard-refresh. They don't. Production deploys looked correct (latest HTML on `notepad-pwa-eight.vercel.app`) while users with v3/v4 installs kept seeing pre-v5 content.

## 2026-04-28 — UI refresh: autosave-only, editable hint, icon chrome (v5)

Builds on the cloud-only v5 (below) to refresh the post-entry chrome.

- **Lock button removed.** The 1s input-debounce autosave plus the awaited `pushCloud()` flush already covered saving — Lock was redundant. The button's other role (return to phrase screen) moves to a new switch-notepad icon below.
- **Switch-notepad icon** added to the header (Lucide `repeat-2`) — same destination Lock used to take you to (phrase screen, ready for a different phrase) but framed as switching notepads, not locking for security. Awaits the in-flight `pushCloud()` before tearing down the in-memory key, inheriting the v5 lock-flush guarantee.
- **Editable hint** in the header H1 — replaces the static "Notepad" word with a per-notepad clue the user writes themselves ("Alias-game" style: helps you identify which notepad you're in, but is never the phrase itself). Stored encrypted alongside `pages` in the same blob, so the cloud-only privacy model holds (the hint never appears on the phrase screen). Rendered via `textContent` (XSS-safe), single-line (Enter blurs, paste strips line breaks), 120-char cap.
- **Clear moved off the header** onto the editor surface as a floating trash icon (Lucide `trash-2`). Top-right of `.container`, 0.4 opacity at rest, lifts to 1 on hover/focus. Confirm dialog unchanged.
- **Iconography codified in the design system.** Cloud-only v5 introduced the eye toggle on the phrase input; this refresh extends it. Added `.icon-btn` variant (28×28 desktop / 24×24 mobile) and `.icon-btn--floating` sub-variant. `design.md`: added the Iconography component spec, the Editable hint spec, and the v5-UI-refresh removed-components note.
- **Mobile-first polish.** `white-space: nowrap` on header chips and buttons so the action cluster doesn't wrap awkwardly at 375px. Header H1 truncates at `40vw` on mobile.

## 2026-04-27 — Post-merge smoke test in CI

- Added `.github/workflows/post-merge-smoke.yml` that runs on every push to `main`. Polls the production URL until Vercel finishes deploying this commit's `sw.js`, then verifies four things: the homepage HTML still has the phrase input + CSS specificity fix + Supabase client import; the design system page loads; the Supabase `notes` table accepts a write+delete cycle. Catches the regressions we hit this session (CSS bug, deploy protection re-enabled, table dropped). No secrets needed — the publishable Supabase key is already public-by-design in `index.html`.

## 2026-04-27 — Cloud-only architecture (v5)

- **Removed all browser-side persistence.** Supabase is now the sole source of truth. The encrypted `localStorage` blob (`notepad-data`, `notepad-id`) is gone — every entry pulls from Supabase, every save pushes to Supabase. The app behaves identically across any browser cache state: fresh, stale, cleared, or incognito. Nothing is stored in the browser between sessions.
- **Service Worker retired.** `sw.js` was a cache-first offline shell; with no offline mode there's no reason to intercept fetches. The file is replaced by a self-destructing SW that unregisters itself and clears all caches on activate, so existing v4 PWA installs migrate cleanly. The HTML no longer registers a SW. (`sw.js` can be deleted entirely in a future release once we're confident no v4 installs remain.)
- **Network failure on entry now blocks instead of silently corrupting cloud state.** Previously, a Supabase reachability error during `pullCloud()` was treated like "no data found", and the user proceeded into an empty editor — whose first save would overwrite their actual cloud blob. Now `pullCloud()` throws on network/permission errors, and `enter()` shows "Couldn't reach server. Try again." while keeping the user on the phrase screen. Decrypt-fail still proceeds as fresh (per v4).
- **Lock now flushes pending edits.** Previously `lock()` queued a 1s push and immediately nulled the crypto key, so the queued push fired with a null key and silently no-op'd — losing any unsynced edits. The localStorage blob masked this loss; cloud-only would not. `lock()` is now async and awaits `pushCloud()` before clearing the key.
- **One-shot legacy cleanup** runs on every load: drops `notepad-*` localStorage keys from v1/v2/v3/v4 and unregisters any pre-existing Service Worker. Idempotent.

### Tradeoffs accepted
- No offline mode. Every entry needs network.
- Slower cold load (~200–500ms Supabase round-trip on entry; was instant when warm-cached).
- Reload during edit can lose up to ~1s of typing (was preserved by localStorage every keystroke).

## 2026-04-27 — Phrase screen stuck after entry (v4)

- **Bug:** entering a phrase ran the unlock flow successfully, but the homepage overlay never disappeared. Cause was a CSS specificity tie: `.phrase-screen { display: flex }` (specificity 0,0,1,0) and the UA `[hidden] { display: none }` (also 0,0,1,0) collide, and author CSS wins on ties — so the `hidden` attribute did nothing for this element. Added `.phrase-screen[hidden] { display: none; }` (specificity 0,0,2,0).
- **Decrypt-fail no longer blocks entry.** A phrase whose stored ciphertext fails to decrypt (corruption or rare ID-hash collision) now silently proceeds into an empty notepad; the first save overwrites the unreadable blob. Previously this raised a user-facing error.
- **Service worker** bumped to `notepad-v4` to force the fixed HTML to active PWA installs.

## 2026-04-27 — Auth replaced by client-side encryption (v3)

- **Why:** the previous "phrase as fake email + Supabase password" scheme was rejected by Supabase Auth — it validates email format and the synthetic `<hash>@notepad.local` address fails. Rather than fight Supabase Auth, the auth concept is gone entirely.
- **Homepage:** now a single password-style input + "Enter" button, centered. No phrase length validation, no sign-up vs sign-in distinction.
- **Architecture:** the phrase derives both an identifier (`sha256(phrase + salt)`) and an AES-GCM-256 encryption key (PBKDF2 with 100k iterations). Server stores ciphertext only, keyed by the identifier. Anyone with the phrase can decrypt; nobody else can.
- **Local cache also encrypted:** `localStorage` stores the same encrypted blob the server does, so no plaintext sits at rest anywhere.
- **Schema migration required** in Supabase: drop the old `pages` and `settings` tables, create a single `notes` table (`id text PK, encrypted text, updated_at timestamptz`) with public RLS policy. Email-confirmation toggle is no longer relevant — Supabase Auth isn't used.
- **Removed components:** auth dialog, merge dialog, all dialog UI. `design.md` updated to reflect the new component set; the dialog styles are kept as "reserved" for future use.
- **Service worker** bumped to `notepad-v3` to force returning users to pick up the new HTML.

## 2026-04-27 — Design system v2 (post-audit reconciliation)

- Ran `/design-critique` on the audit page and `/design-system` on spec-vs-code; reconciled findings.
- **Spec/code drift fixed:** `index.html` dialog `<p>` font-size bumped from 13px → 14px to match `design.md`.
- **`design.md` taxonomy fixed:** moved `text/border-hover #666` to Rules as `rule/hover`; collapsed the Text ramp from 7 to 5 tokens; folded the unused-as-text `text/hover` into the Button component spec.
- **New tokens:** `motion/quick 150ms`, `overlay/scrim rgba(0,0,0,0.7)`, three `track/*` letter-spacing tokens (`wide 2px`, `medium 1px`, `tight 0.5px`).
- **Missing component states added:** Button gains `loading` (the "Working…" state used during async); Status chips gain explicit `pending` (visually identical to idle but conceptually distinct); Editor gains explicit `focused` state notes.
- **Accessibility section added** to `design.md` — per-component notes plus a system-level table covering contrast, touch targets, focus, motion, and live-region gaps. No code changes yet; gaps tracked.
- **`design-system.html` v2:** text-color tokens now render as actual text (not chips); rules render as actual 1px lines; gold paired with on-gold; status tokens shown as real status text. Added top-of-page TOC, `<main>` landmark, layout-shell diagram, anti-jitter min-width callouts, and inline a11y notes per section. Doc-page meta text lifted from `#555` to `#777` for readability with a deviation note explaining why.

## 2026-04-27 — Design system documented

- Added `design.md` — written spec for color, typography, spacing, and component tokens, extracted from the inline CSS in `index.html`.
- Added `design-system.html` — single-file visual audit page. Open it at `/design-system.html` (locally or on the deployed site) to see every token and component variant rendered side by side.
- Added this file. Future visual changes should each get their own dated entry.

## 2026-04-27 — Supabase auth + cloud sync

- Notes now persist across devices via Supabase. Each user signs in with a single phrase (no email, no separate password) and gets their own private notes via Row Level Security.
- Guest mode preserved — anyone can scribble in `localStorage` before signing in. Signing in for the first time migrates local notes up; existing accounts get a merge dialog when local and cloud differ.
- Removed the hardcoded portfolio CV that was previously baked into page 2 of the editor. The notepad now starts as an empty page.
- Bumped service worker cache to `v2` so returning users actually receive the new HTML.
- Sanitized editor HTML on read with DOMPurify before injecting back into the DOM, to harden against malicious content round-tripping through the cloud.

## 2026-04-26 — Initial commit

- Static-HTML PWA notepad with `localStorage` persistence, page nav, swipe + keyboard shortcuts, offline service worker.
