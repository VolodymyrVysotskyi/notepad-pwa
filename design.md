# Notepad — Design System

The written spec for the visual language used in `index.html`. The runtime CSS lives inline in that file; this doc is the source of truth for *intent* (which token belongs where, what each color is for, what state a component supports). When the two diverge, this doc wins and `index.html` should be reconciled.

For a visual reference of every token and component, open `design-system.html`.

---

## Brand voice

A dark, serif notepad. Calm and quiet by default; gold is reserved for things you can act on. Copy is terse — "Sign in", "Clear", "Working…" — never enthusiastic. The interface should feel like a private writing tool, not a product surface.

---

## Color tokens

All colors are literal hex; no CSS variables. Group by intent — never by shade.

### Surfaces

| Hex       | Token            | Used for |
|-----------|------------------|----------|
| `#1a1a1a` | `surface/body`   | Page background |
| `#111111` | `surface/raised` | Header bar, dialog input field — both surfaces are darker than body by the same delta |
| `#1f1f1f` | `surface/dialog` | Modal dialog body |

### Text

A four-step ramp from primary to subtlest. Use the lightest tone that still reads in context.

| Hex       | Token              | Used for |
|-----------|--------------------|----------|
| `#e0e0e0` | `text/primary`     | Editor body, dialog heading, input value |
| `#999999` | `text/secondary`   | Dialog body paragraph |
| `#888888` | `text/muted`       | Header H1, default button label |
| `#777777` | `text/hint`        | Dialog hint line, button label on hover |
| `#555555` | `text/meta`        | Word count, page nav, sync status |

### Rules

| Hex       | Token            | Used for |
|-----------|------------------|----------|
| `#333333` | `rule/default`   | Buttons, dialogs, dialog input |
| `#2a2a2a` | `rule/header`    | Header bottom edge |
| `#666666` | `rule/hover`     | Button border on hover |

### Accent

| Hex       | Token             | Used for |
|-----------|-------------------|----------|
| `#f4c430` | `accent/gold`     | Primary action, focus border, link, hint emphasis |
| `#000000` | `accent/on-gold`  | Text on a filled gold surface — only used in opposition to `accent/gold` |

### Status

| Hex       | Token              | Used for |
|-----------|--------------------|----------|
| `#c0392b` | `status/danger-edge` | Danger button border on hover, sync status when network errors |
| `#e74c3c` | `status/danger`    | Danger button label on hover, dialog error text |
| `#4a7c4a` | `status/ok`        | Sync status when last write succeeded |

### Overlay

| Value                | Token            | Used for |
|----------------------|------------------|----------|
| `rgba(0,0,0,0.7)`    | `overlay/scrim`  | Dialog `::backdrop` |

> **Note on `text/hover`** (was previously a token): the value `#cccccc` was specified for "button label on hover" but the live code uses `#cccccc` only on the *default* button hover state (`color: #ccc`). Reconciliation: `#ccc` rounds to `#cccccc` at the precision we care about — but the *use* is button-specific, not a general text color. It's documented inline in the Button component spec rather than as a top-level token.

---

## Typography

One typeface, one family stack:

```
font-family: 'Georgia', serif;
```

### Scale

| Size  | Weight | Tracking      | Used for |
|-------|--------|---------------|----------|
| 16px  | 400    | `track/wide`, UPPERCASE | Header H1 ("Notepad") |
| 15px  | 600    | `track/tight` | Dialog heading (H3) |
| 15px  | 400    | —             | Editor body |
| 14px  | 400    | —             | Dialog body paragraph, dialog input |
| 13px  | 400    | —             | Buttons |
| 12px  | 400    | —             | Word count, page nav, dialog hint, dialog error |
| 11px  | 400    | —             | Sync status |

### Letter-spacing tokens

| Value     | Token          | Used for |
|-----------|----------------|----------|
| `2px`     | `track/wide`   | Header H1 (uppercase) |
| `1px`     | `track/medium` | Header H1 on mobile |
| `0.5px`   | `track/tight`  | Dialog H3 |

### Line-height

| Context | line-height |
|---------|-------------|
| Editor body | 1.8 |
| Dialog body | 1.5 |
| Everything else | inherits 1.0–1.2 |

---

## Spacing & layout

### Layout shell

The page does *not* scroll. The body is fixed at `100vh` with `overflow: hidden`; the editor's container is the scroller. This keeps the header always visible and avoids the rubber-band/over-scroll feel that breaks the "writing tool" illusion. Required for the design — don't remove without picking up the chrome-pinning logic elsewhere.

```
body          → height 100vh, overflow hidden, flex column
└── header    → fixed at top
└── container → flex 1, overflow auto (this is what scrolls)
    └── editor → max-width 900px, contenteditable
└── dialogs   → portal-style, lazy-rendered
```

### Frame

| Region | Padding | Mobile (≤768px) |
|--------|---------|-----------------|
| Header | `14px 24px` | `10px 14px` |
| Container (editor wrap) | `48px` | `24px` |
| Dialog body | `24px` | unchanged |

### Clusters

| Cluster | Gap | Mobile |
|---------|-----|--------|
| Header `.actions` | `10px` | `6px` |
| Header `.nav-buttons` | `8px` | unchanged |
| Dialog `.dialog-actions` | `8px` | unchanged (wraps) |

### Content well

- Max width: `900px` (centered inside container, constant across viewports).
- Editor surface `outline: none` — the page itself is the editor; no chrome around the writing area.

### Controls

| Control | Padding | Mobile |
|---------|---------|--------|
| Button | `5px 14px` | `4px 10px` |
| Dialog input | `10px 12px` | unchanged |

### Anti-jitter min-widths

Three places explicitly reserve horizontal space so transient content doesn't reflow neighbors:

| Element | min-width | Reason |
|---------|-----------|--------|
| `.page-info` | `60px` | "1 / 1" → "10 / 10" must not push the Next button |
| `.sync-status` | `70px` | "Synced" / "Saving…" / "Network error" all share the slot |
| `.dialog-actions button` | `120px` | Two-button rows stay equal-width even when labels differ |

### Other magic values

| Value | Where | Reason |
|-------|-------|--------|
| `min-height: 16px` on `dialog .error` | Dialog error line | Reserves space so an error appearing doesn't shift the actions row down |
| `margin: 8px 0 4px` on dialog input | Dialog input | Asymmetric spacing — sits closer to the hint below than to the paragraph above |

---

## Border radius

| Radius | Used for |
|--------|----------|
| `4px`  | Buttons, dialog input |
| `6px`  | Dialog body |

---

## Motion

| Value | Token | Used for |
|-------|-------|----------|
| `150ms` | `motion/quick` | Button color/border transitions (`transition: all 0.15s`) |

There is no other motion in the system — no entrance choreography, no loading spinners, no easings beyond browser default. If we add motion, this section grows; until then, every change should ask whether it really needs it.

> **Reduced motion:** the `motion/quick` transition isn't currently wrapped in `@media (prefers-reduced-motion)`. Acceptable today (150ms is below the perception threshold for most users), but flag if we add longer durations.

---

## Components

### Header

The page chrome. Logo (H1) on the left, action cluster on the right. Single bottom border (`rule/header`) is the only divider on the page.

**States:** none — the header is static.

**Accessibility:**
- Role: `<header>` (implicit `banner` landmark).
- Should be wrapped by `<main>` for the editor below — not currently the case in `index.html`. Add when we touch the markup.

### Button

Five variants. Four states per variant (default / hover / disabled / loading). No focus ring — keyboard users currently rely on browser default outline (acceptable for an MVP; tracked as an accessibility gap below).

| Variant | Default | Hover | Notes |
|---------|---------|-------|-------|
| `default` | border `rule/default` · color `text/muted` · bg transparent | border `rule/hover` · color `#cccccc` | The base. All chrome buttons start here. |
| `disabled` | as default + `opacity: 0.3` + `cursor: not-allowed` | (no hover affordance) | Used for prev when at first page. |
| `loading` | as `disabled` + label swaps to "Working…" | (no hover affordance) | Used for `phraseSubmit` while async runs. The button stays disabled until the async resolves. |
| `danger` | inherits `default` | border `status/danger-edge` · color `status/danger` | "Clear" button. Hover-only red. |
| `primary` | border `accent/gold` · color `accent/gold` · bg transparent | bg `accent/gold` · color `accent/on-gold` | Modal confirm. Always paired with a default-style cancel. |

All buttons share: `border-radius: 4px`, `padding: 5px 14px`, font 13px, `transition: all motion/quick`, family inherits Georgia.

**Accessibility:**
- Touch target: 28px tall — below the 44px iOS / 48dp Material guideline. Acceptable on desktop, brittle on touch. Documented trade-off; revisit when we redesign mobile.
- Keyboard: Tab focuses, Enter/Space activates (browser default). No custom focus ring — relies on browser outline.
- Screen reader: every button has visible text content (no icon-only buttons), so labels are inherent.

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
| Error | `status/danger-edge` | "Network error" or message | Upsert failed |

**Accessibility:**
- Sync status changes silently — should add `aria-live="polite"` on the `<span>` so screen readers announce state changes. Not currently wired; tracked.

### Dialog (modal)

Native `<dialog>` element with custom styling. Backdrop is `overlay/scrim`.

**Anatomy** (top to bottom):
1. **Heading** (H3) — 15px / 600 / `text/primary`, `track/tight`, `margin-bottom: 8px`.
2. **Body paragraph** — 14px / 400 / `text/secondary`, `line-height: 1.5`, `margin-bottom: 12px`.
3. **Input** (optional) — see below; sits with asymmetric `8px / 4px` margin.
4. **Hint** — 12px / `text/hint`, with `<strong>` accent rendered in `accent/gold` (600).
5. **Error** — 12px / `status/danger`, `min-height: 16px` so the layout doesn't jump when an error appears.
6. **Actions row** — buttons in `.dialog-actions`, gap `8px`, `flex-wrap: wrap`. Each button stretches to `flex: 1` with `min-width: 120px`.

**Geometry:** `padding: 24px`, `border-radius: 6px`, `border: 1px solid rule/default`, `max-width: 460px`, `width: calc(100% - 32px)`.

**Variants:**

| Variant | Has input? | Buttons |
|---------|------------|---------|
| Auth dialog | yes | Cancel + primary "Sign in / Create" |
| Merge dialog | no | "Keep cloud only" + "Keep local only" + primary "Merge both" |

**Accessibility:**
- Native `<dialog>` provides: focus trap, `Escape` to close, inert background while open. ✓ For free.
- Missing: `aria-labelledby` pointing the dialog at its `<h3>` so screen readers announce the heading on open. Add to next markup change.
- Missing: explicit `aria-describedby` for the body paragraph.

### Dialog input (text)

| State | Border | Background |
|-------|--------|------------|
| Default | `1px solid rule/default` | `surface/raised` |
| Focused | `1px solid accent/gold` | `surface/raised` |

Padding `10px 12px`, font 14px Georgia, color `text/primary`, no `outline` (border is the only focus indicator).

**Why `outline: none`:** Two visible focus indicators (browser outline + custom border) would compete and one would always look wrong in dark mode. The gold border is the deliberate replacement.

**Accessibility:**
- Currently used only in the auth dialog with `autocomplete="off" spellcheck="false" autocapitalize="off"` — appropriate for a passphrase-style secret that shouldn't be browser-cached.
- Error text below the input is *not* programmatically associated. Should add `aria-describedby="phraseError"` and `aria-invalid="true"` when an error is present.

### Editor surface

The writing area itself. `contenteditable`, `max-width: 900px`, `font-size: 15px`, `line-height: 1.8`.

| State | Visual |
|-------|--------|
| Default | No chrome — the surface is the surrounding container |
| Focused | `outline: none` — visually identical to default. The cursor is the focus indicator. |
| Empty | No placeholder — empty space is the empty state. Documented choice; revisit if onboarding becomes a priority. |

**Accessibility:**
- `contenteditable="true"` is announced as "edit text" by most screen readers. Adequate for the MVP.
- No `aria-label` — the editor's role is implicit from page context. Could add `aria-label="Notepad editor"` for clarity.
- Sanitization: HTML is run through DOMPurify on read, so paste-injected scripts are stripped before rendering. (Implementation note, not a visual concern.)

---

## Responsive

One breakpoint: `@media (max-width: 768px)`.

What collapses:
- Header padding tightens (`14px 24px` → `10px 14px`); H1 shrinks (`16px` / `track/wide` → `13px` / `track/medium`).
- Container padding halves (`48px` → `24px`).
- Action cluster gap shrinks (`10px` → `6px`); buttons compact (`5px 14px` → `4px 10px`, font `13px` → `12px`).
- Sync status chip is hidden (room is precious).
- Dialog action buttons stack via `flex-wrap` already in the desktop spec — no extra rules needed.

No tablet breakpoint, no large-desktop adjustment. The design is comfortable from ~360px through any wide screen because the editor caps at 900px regardless.

---

## Accessibility — system-level

Documented per component above; this section captures system-wide trade-offs and known gaps so we don't keep rediscovering them.

| Concern | Current state | Trade-off / Plan |
|---------|---------------|------------------|
| Color contrast for `text/meta #555` on `surface/body #1a1a1a` | ≈ 3.5:1 — fails WCAG AA for normal text | Accepted in the live app where context (proximity to controls) supplies meaning. The reference page (`design-system.html`) lifts to `#777`. Revisit if formal accessibility certification becomes a goal. |
| Focus rings on buttons | None (browser default outline) | Acceptable MVP. If we add a focus token later: gold outline at 2px offset would match `accent/gold` usage elsewhere. |
| Touch target sizes | 28px button height — below mobile guidelines | Desktop-first design choice. Mobile redesign is a future workstream. |
| Reduced motion | Not honored | Single 150ms transition is below the threshold most reduced-motion users care about. Document the exception. |
| Live regions | Sync status doesn't announce | Add `aria-live="polite"` next time the chip changes state in JS. |

---

## Out-of-system (intentionally undocumented for now)

Add a section here when we spec these:

- **Light theme** — the app is dark-only. If we ever add a toggle, the spec will need a parallel surface/text ramp.
- **Loading & empty states beyond what's listed** — empty editor is "no placeholder, just space." If we add real empty states (e.g., "no notes yet"), they need their own treatment.
- **Iconography** — we don't have any. Arrows in nav buttons are literal `←` and `→` glyphs.
- **Toast / inline notifications** — sync status is the only async-feedback channel today. If we need to surface non-sync errors, that's a new component.
- **Settings UI** — placeholder mention only. If/when settings exist, they need a surface (sheet? new dialog variant? dedicated page?) and a navigation entry point.
