# Changelog

Notable changes to the notepad. Newest first.

---

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
