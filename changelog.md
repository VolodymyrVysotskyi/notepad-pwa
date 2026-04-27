# Changelog

Notable changes to the notepad. Newest first.

---

## 2026-04-28 — UI refresh: autosave-only, editable hint, icon chrome (v5)

Builds on the cloud-only v5 (below) to refresh the post-entry chrome.

- **Lock button removed.** The 1s input-debounce autosave plus the awaited `pushCloud()` flush already covered saving — Lock was redundant. The button's other role (return to phrase screen) moves to a new switch-notepad icon below.
- **Switch-notepad icon** added to the header (Lucide `repeat-2`) — same destination Lock used to take you to (phrase screen, ready for a different phrase) but framed as switching notepads, not locking for security. Awaits the in-flight `pushCloud()` before tearing down the in-memory key, inheriting the v5 lock-flush guarantee.
- **Editable hint** in the header H1 — replaces the static "Notepad" word with a per-notepad clue the user writes themselves ("Alias-game" style: helps you identify which notepad you're in, but is never the phrase itself). Stored encrypted alongside `pages` in the same blob, so the cloud-only privacy model holds (the hint never appears on the phrase screen). Rendered via `textContent` (XSS-safe), single-line (Enter blurs, paste strips line breaks), 120-char cap.
- **Clear moved off the header** onto the editor surface as a floating trash icon (Lucide `trash-2`). Top-right of `.container`, 0.4 opacity at rest, lifts to 1 on hover/focus. Confirm dialog unchanged.
- **Iconography codified in the design system.** Cloud-only v5 introduced the eye toggle on the phrase input; this refresh extends it. Added `.icon-btn` variant (28×28 desktop / 24×24 mobile) and `.icon-btn--floating` sub-variant. `design.md`: added the Iconography component spec, the Editable hint spec, and the v5-UI-refresh removed-components note.
- **Mobile-first polish.** `white-space: nowrap` on header chips and buttons so the action cluster doesn't wrap awkwardly at 375px. Header H1 truncates at `40vw` on mobile.

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
