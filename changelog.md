# Changelog

Notable changes to the notepad. Newest first.

---

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
