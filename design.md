# Notepad — Design System

The written spec for the visual language used in `index.html`. The runtime CSS lives inline in that file; this doc is the source of truth for *intent* (which token belongs where, what each color is for, what state a component supports). When the two diverge, this doc wins and `index.html` should be reconciled.

For a visual reference of every token and component, open `design-system.html`.

---

## Brand voice

> **Notepad is short and sharp as a pocket knife of a ninja-gangster.**

Wise with a bite. Quiet menace, dry confidence. Every line is a cut — never a paragraph, never a speech. Friendly but precisely keen. Can roast the act of staring at a blank page; never the writer or what they wrote.

System chrome stays terse ("Enter", "Lock", "Clear"). The persona shows up in three reserved slots: the lock-screen intro, the first-open prompt, and the empty-row ghost placeholder.

**Examples in voice:**
- "One phrase locks everything. Forget it, the words go with it." (lock-screen intro)
- "What's it gonna be?" (first-open prompt)
- "Words. Now."
- "Make it count."
- "That's not it. Try again." (wrong phrase)

**Length test:** if a line doesn't fit on a phone screen in one breath, it's too long. Most lines are 2–6 words. The intro is the only line allowed to break twelve.

**Anti-patterns:**
- No paragraphs. Ever. One clause, maybe two.
- No punching down — never mock the user, their topic, or their writing skill.
- No clever-at-the-cost-of-clarity in errors. Errors are stressful; the bite softens to a nudge.
- No motivation, no coaching, no warmth-padding. The notepad has a mouth, not a TED talk.
- The persona never appears in system controls — buttons stay "Enter", "Lock", "Clear".

All persona copy is **static and lives in `index.html`** in a single `AI` constant. There are no LLM calls; the encryption model (nothing plaintext leaves the browser) stays intact.

---

## Design principles

Eight rules. Each one cuts. The voice in copy is the voice in design.

1. **One job. Writing.** No settings, no themes, no toolbar, no rich text. If a feature isn't a sentence on a page, it doesn't ship.
2. **Quiet until you act.** Gold is the only color that means *do something*. Nothing else moves, blinks, or pulses. Calm is the default state.
3. **Words, not chrome.** No icons. Buttons are verbs ("Lock", "Clear"). Arrows are literal `←` and `→` glyphs. The page does not need a logo, a brand mark, or decoration.
4. **Encryption is the privacy.** No accounts. No email. No recovery. The phrase is the key and the identifier. Lose it, lose the words. Document this; do not soften it with optimism.
5. **One screen at a time.** Lock screen or editor — never both, never a modal between them. State transitions are visibility toggles, not animations.
6. **No spinners. No skeletons.** "Working…" is the only loading state. If it takes long enough to need a spinner, it's a bug.
7. **Brevity is structural.** Copy length is a constraint, not a preference. If a line doesn't fit on a phone in one breath, cut it. Apply to UI labels, error messages, and persona copy alike.
8. **Doc wins on drift.** When `design.md` and `index.html` disagree, the doc is right and the code gets reconciled. New patterns get a section here before they get a line of CSS.

---

## Authentication & encryption (architecture, not visual)

Worth surfacing here because it shapes what UI exists and what doesn't:

- **No accounts, no email, no Supabase Auth.** The user enters one phrase. That phrase IS both the identifier (server keys rows by `sha256(phrase + 'notepad-id-v1')`) and the encryption key (PBKDF2 → AES-GCM-256, 100k iterations).
- **Server stores ciphertext only.** Even with full database access, an attacker without the phrase sees opaque blobs. The Supabase `notes` table has `id text PK`, `encrypted text`, `updated_at`. Public RLS policy — encryption is the privacy layer.
- **localStorage is also encrypted** with the same key. Closing the tab does not lose the key (re-enter on next open), but no plaintext sits at rest anywhere.
- **No phrase validation.** Whatever the user types becomes the credential. Short phrases are insecure; long ones are recommended in copy but not enforced. Phrase recovery is impossible by design.

This means: no sign-up vs. sign-in distinction (same flow), no dialogs for auth, no email confirmation, no merge UI (single-row model). The whole UI surface for "auth" is one input and one button.

---

## Color tokens

All colors are literal hex; no CSS variables. Group by intent — never by shade.

### Surfaces

| Hex       | Token            | Used for |
|-----------|------------------|----------|
| `#1a1a1a` | `surface/body`   | Page background, phrase screen background |
| `#111111` | `surface/raised` | Header bar, phrase input, dialog input |
| `#1f1f1f` | `surface/dialog` | Reserved for future modal surfaces (no dialogs in v3) |

### Text

A four-step ramp from primary to subtlest. Use the lightest tone that still reads in context.

| Hex       | Token              | Used for |
|-----------|--------------------|----------|
| `#e0e0e0` | `text/primary`     | Editor body, input value |
| `#999999` | `text/secondary`   | (Reserved — was dialog body in v2) |
| `#888888` | `text/muted`       | Header H1, phrase title, default button label |
| `#777777` | `text/hint`        | Reserved for hint text; button label on hover |
| `#555555` | `text/meta`        | Word count, page nav, sync status idle |

### Rules

| Hex       | Token            | Used for |
|-----------|------------------|----------|
| `#333333` | `rule/default`   | Buttons, phrase input, (future) dialogs |
| `#2a2a2a` | `rule/header`    | Header bottom edge |
| `#666666` | `rule/hover`     | Button border on hover |

### Accent

| Hex       | Token             | Used for |
|-----------|-------------------|----------|
| `#f4c430` | `accent/gold`     | Primary action (Enter button), focus border |
| `#000000` | `accent/on-gold`  | Text on a filled gold surface — only used in opposition to `accent/gold` |

### Status

| Hex       | Token              | Used for |
|-----------|--------------------|----------|
| `#c0392b` | `status/danger-edge` | Danger button border on hover, sync status when network errors |
| `#e74c3c` | `status/danger`    | Danger button label on hover, phrase error text |
| `#4a7c4a` | `status/ok`        | Sync status when last write succeeded |

### Overlay

| Value                | Token            | Used for |
|----------------------|------------------|----------|
| `rgba(0,0,0,0.7)`    | `overlay/scrim`  | Reserved for future modal backdrop (no dialogs in v3) |

---

## Typography

One typeface, one family stack:

```
font-family: 'Georgia', serif;
```

### Scale

| Size  | Weight | Tracking      | Used for |
|-------|--------|---------------|----------|
| 16px  | 400    | `track/wide`, UPPERCASE | Header H1 ("Notepad"), phrase title |
| 15px  | 400    | —             | Editor body, phrase input |
| 14px  | 400    | —             | Enter button |
| 13px  | 400    | —             | Header buttons (Prev / Next / Lock / Clear) |
| 12px  | 400    | —             | Word count, page nav, phrase error |
| 11px  | 400    | —             | Sync status |

### Letter-spacing tokens

| Value     | Token          | Used for |
|-----------|----------------|----------|
| `2px`     | `track/wide`   | Header H1, phrase title (uppercase) |
| `1px`     | `track/medium` | Header H1 on mobile |
| `0.5px`   | `track/tight`  | Reserved (was dialog H3 in v2) |

### Line-height

| Context | line-height |
|---------|-------------|
| Editor body | 1.8 |
| Phrase error | 1.5 |
| Everything else | inherits 1.0–1.2 |

---

## Spacing & layout

### Layout shell

The body is fixed at `100vh` with `overflow: hidden`; the editor's container is the scroller. The phrase screen is a `position: fixed` overlay covering the entire viewport — it lives outside the header/container flow because there's no header until the user enters a phrase.

```
body (100vh, overflow hidden, flex column)
├── phrase-screen (position fixed, z-index 10) — visible by default
└── (when entered)
    ├── header — fixed at top, always visible
    └── container — flex 1, overflow auto (scrolls)
        └── editor — max-width 900px, contenteditable
```

### Frame

| Region | Padding | Mobile (≤768px) |
|--------|---------|-----------------|
| Phrase screen | `32px` (centered content) | unchanged |
| Header | `14px 24px` | `10px 14px` |
| Container (editor wrap) | `48px` | `24px` |

### Clusters

| Cluster | Gap | Mobile |
|---------|-----|--------|
| Header `.actions` | `10px` | `6px` |
| Header `.nav-buttons` | `8px` | unchanged |
| Phrase form | `12px` | unchanged |

### Content well

- Editor max width: `900px` (centered inside container, constant across viewports).
- Phrase form max width: `360px` (single-column form, narrow for focus).

### Controls

| Control | Padding | Mobile |
|---------|---------|--------|
| Header button | `5px 14px` | `4px 10px` |
| Phrase input | `12px 16px` | unchanged |
| Enter button | `12px 16px` | unchanged |

### Anti-jitter min-widths

| Element | min-width | Reason |
|---------|-----------|--------|
| `.page-info` | `60px` | "1 / 1" → "10 / 10" must not push the Next button |
| `.sync-status` | `70px` | "Synced" / "Saving…" / "Network error" all share the slot |

---

## Border radius

| Radius | Used for |
|--------|----------|
| `4px`  | Buttons, phrase input |
| `6px`  | Reserved for future dialogs |

---

## Motion

| Value | Token | Used for |
|-------|-------|----------|
| `150ms` | `motion/quick` | Button color/border transitions, Enter button hover |

---

## Components

### Phrase screen (homepage)

The default state of the app. A full-viewport overlay containing only:

- **Title** — "Notepad" rendered identically to the header H1 (16px / 400 / `text/muted` / `track/wide` / uppercase). Sits 24px above the AI intro.
- **AI intro** — 1–2 sentence persona line in italic Georgia, 14px / `text/muted` / line-height 1.5, max-width 360px (matches form width), centered. Sits 28px above the form. This is the "what is this?" copy — replaces the previous policy of "the title is the explanation". The exact text lives in `AI.intro`.
- **Form** — vertical stack, gap 12px, max-width 360px.
  1. **Phrase input** (see below).
  2. **Enter button** (primary variant, full-width).
  3. **Phrase error** — 12px / `status/danger`, min-height 16px so layout doesn't jump when an error appears.

Centered both axes. No other chrome.

**States:**
- Default — empty input, focused.
- Working — Enter button shows "Working…", disabled.
- Error — phrase error in voice ("That's not it. Try again."); input retains value so user can retry.

**Accessibility:**
- Input is `type="password"` (masks the phrase).
- `autocomplete="off" spellcheck="false" autocapitalize="off"` — appropriate for a secret.
- `autofocus` on load.
- Form submit on Enter key.

### Phrase input

| State | Border | Background |
|-------|--------|------------|
| Default | `1px solid rule/default` | `surface/raised` |
| Focused | `1px solid accent/gold` | `surface/raised` |

Padding `12px 16px` (slightly larger than dialog inputs were), font 15px Georgia (matches editor body), color `text/primary`, no `outline`.

### Header

Logo (H1) on the left, action cluster on the right. Single bottom border (`rule/header`) is the only divider on the page. Hidden on the phrase screen — appears once a phrase is entered.

**States:** none — the header is static.

**Accessibility:**
- Implicit `banner` landmark from `<header>`.
- Should be wrapped by `<main>` for the editor below — not currently the case in `index.html`. Track for next markup change.

### Button

Five variants. Four states per variant (default / hover / disabled / loading).

| Variant | Default | Hover | Notes |
|---------|---------|-------|-------|
| `default` | border `rule/default` · color `text/muted` · bg transparent | border `rule/hover` · color `#cccccc` | Used for Prev / Next / Lock. The base. |
| `disabled` | as default + `opacity: 0.3` + `cursor: not-allowed` | (no hover) | Used for Prev when at first page. |
| `loading` | as `disabled` + label swaps to "Working…" | (no hover) | Used for the Enter button while async work runs. |
| `danger` | inherits `default` | border `status/danger-edge` · color `status/danger` | Used for Clear. Hover-only red. |
| `primary` | border `accent/gold` · color `accent/gold` · bg transparent | bg `accent/gold` · color `accent/on-gold` | Used for the Enter button on the phrase screen. Wider padding (`12px 16px`) than header buttons. |

Header buttons share: `border-radius: 4px`, `padding: 5px 14px`, font 13px, `transition: all motion/quick`, family inherits Georgia.

The primary Enter button uses `padding: 12px 16px` and font 14px — larger because it's the only action on its screen.

**Accessibility:**
- Touch target: 28px tall for header buttons — below 44px iOS / 48dp Material guideline. Acceptable on desktop, brittle on touch. Documented trade-off.
- Enter button is 48px tall (12+12 padding + 14 + line-height) — passes touch guidelines.
- No custom focus ring; relies on browser default outline.

### Status chips

Inline text, no background. Three slots in the header right cluster, in this order (left to right): sync status → word count → page nav.

| Chip | Color | States |
|------|-------|--------|
| Word count | `text/meta` | Single state. Pluralizes "0 words" / "1 word" / "N words". |
| Page info | `text/meta` | Single state. `min-width: 60px` so position is stable. |
| Sync status | 4 states (see below) | 11px, narrower than the others. Hidden on mobile. |

**Sync status states:**

| State | Color | Text | Trigger |
|-------|-------|------|---------|
| Idle | `text/meta` | (empty) | Default before/between syncs |
| Pending | `text/meta` | "Saving…" | Edit queued, awaiting Supabase upsert |
| OK | `status/ok` | "Synced" | Upsert returned success |
| Error | `status/danger-edge` | message | Upsert failed |

**Accessibility:**
- Sync status changes silently — should add `aria-live="polite"`. Tracked.

### Editor surface

The writing area. `contenteditable`, `max-width: 900px`, `font-size: 15px`, `line-height: 1.8`.

| State | Visual |
|-------|--------|
| Default | No chrome — the surface is the surrounding container |
| Focused | `outline: none` — visually identical to default. Cursor is the focus indicator. |
| Empty (current line) | AI ghost placeholder — see below. |

**Accessibility:**
- `contenteditable="true"` is announced as "edit text" by most screen readers.
- HTML is run through DOMPurify on read, so paste-injected scripts are stripped before rendering.

### AI ghost placeholder

A faint italic prompt in the persona's voice that appears on the **current empty block under the cursor** (Notion/Bear style). Moves with the cursor and disappears the moment the user types.

| Property | Value |
|----------|-------|
| Color | `text/meta` (`#555`) |
| Font | Georgia italic, inherits editor 15px / line-height 1.8 |
| Trigger | Block element (direct child of `.content`, or `.content` itself) is empty AND editor is focused |
| Persistence | **Never** persisted — `data-placeholder` attribute is stripped by `cleanForSave()` before encrypt |
| Source | `AI.firstPrompt` on the freshly-unlocked empty page; otherwise `AI.rowPlaceholders[lineIndex % pool.length]` (deterministic, no flicker) |
| Implementation | `data-placeholder` attribute on the empty block + `::before` pseudo-element that reads the attribute |

**Technical notes:**
- On script init, `document.execCommand('defaultParagraphSeparator', false, 'div')` makes Enter wrap each line in `<div>` so per-line targeting works in Chrome/Safari.
- `updateGhost()` runs on `selectionchange` (when editor is focused), `input`, `focus`, and after page load / nav.
- `clearGhost()` runs on `blur` so the ghost doesn't show when the user is on the lock button or sync chip.
- An unfocused, wholly-empty editor still shows the prompt (so the user sees the AI's question before clicking in).

---

## Removed in v3 (formerly documented)

These components existed in v2 and have been removed:

- **Auth dialog** — replaced by the phrase screen (see above). The "fake email" auth flow that drove the dialog is gone.
- **Merge dialog** — replaced by single-row encrypted-blob model. No conflict resolution UI needed because there's only ever one blob per phrase; last write wins implicitly.
- **Dialog component** as a whole — currently no `<dialog>` elements in the markup. The styles are documented under "Reserved" above so they're ready to be reused if a future feature needs a modal.

---

## Responsive

One breakpoint: `@media (max-width: 768px)`.

What collapses:
- Header padding tightens (`14px 24px` → `10px 14px`); H1 shrinks (`16px` / `track/wide` → `13px` / `track/medium`).
- Container padding halves (`48px` → `24px`).
- Action cluster gap shrinks (`10px` → `6px`); buttons compact (`5px 14px` → `4px 10px`, font `13px` → `12px`).
- Sync status chip is hidden.
- Phrase screen is unaffected — it's already centered + max-width 360px.

---

## Accessibility — system-level

| Concern | Current state | Trade-off / Plan |
|---------|---------------|------------------|
| Color contrast for `text/meta #555` on `surface/body #1a1a1a` | ≈ 3.5:1 — fails WCAG AA | Accepted in the live app; reference page (`design-system.html`) lifts to `#777`. |
| Focus rings on header buttons | None (browser default outline) | Acceptable MVP. |
| Touch target sizes | 28px header button height — below mobile guidelines | Desktop-first design choice. Enter button passes (48px). |
| Reduced motion | Not honored | 150ms transitions are below the threshold most users care about. |
| Live regions | Sync status doesn't announce | Add `aria-live="polite"` next time the chip changes state in JS. |
| Phrase secrecy | Phrase masked via `type="password"` | ✓ |
| Phrase recovery | Impossible by design | Surface this in copy when we add explanatory help. Currently undocumented in UI. |

---

## Out-of-system (intentionally undocumented for now)

- **Light theme** — dark-only.
- **Loading states beyond "Working…" on Enter** — no spinners, no skeletons.
- **Iconography** — none. Arrows in nav buttons are literal `←` and `→` glyphs.
- **Toast / inline notifications** — sync status is the only async-feedback channel.
- **Settings UI** — none planned.
- **Onboarding / first-run education** — phrase screen is the first run; the AI intro line is the explanation. Anything beyond a 1–2 sentence persona line is a new pattern.
