# Notepad — Design System

The written spec for the visual language used in `index.html`. The runtime CSS lives inline in that file; this doc is the source of truth for *intent* (which token belongs where, what each color is for). When the two diverge, this doc wins and `index.html` should be reconciled.

For a visual reference of every token and component, open `design-system.html` in a browser.

---

## Brand voice

A dark, serif notepad. Calm and quiet by default; gold is reserved for things you can act on. Copy is terse — "Sign in", "Clear", "Working…" — never enthusiastic. The interface should feel like a private writing tool, not a product surface.

---

## Color tokens

All colors are literal hex; no CSS variables. Group by intent.

### Surfaces

| Hex       | Token            | Used for |
|-----------|------------------|----------|
| `#1a1a1a` | `surface/body`   | Page background |
| `#111111` | `surface/raised` | Header bar, dialog input field |
| `#1f1f1f` | `surface/dialog` | Modal dialog body |

### Text

A six-step muted ramp from primary to subtlest. Use the lightest tone that still reads.

| Hex       | Token              | Used for |
|-----------|--------------------|----------|
| `#e0e0e0` | `text/primary`     | Editor body, dialog heading, input value |
| `#cccccc` | `text/hover`       | Button label on hover only |
| `#999999` | `text/secondary`   | Dialog body paragraph |
| `#888888` | `text/muted`       | Header H1, default button label |
| `#777777` | `text/hint`        | Dialog hint line |
| `#666666` | `text/border-hover`| Button border on hover (text-adjacent ramp) |
| `#555555` | `text/meta`        | Word count, page count, sync status |

### Rules / borders

| Hex       | Token            | Used for |
|-----------|------------------|----------|
| `#333333` | `rule/default`   | Buttons, dialogs, inputs |
| `#2a2a2a` | `rule/header`    | Header bottom edge |

### Accent

| Hex       | Token         | Used for |
|-----------|---------------|----------|
| `#f4c430` | `accent/gold` | Primary action, focus ring, link, hint emphasis |
| `#000000` | `accent/on-gold` | Text on a filled gold surface (only context where black is used) |

### Status

| Hex       | Token              | Used for |
|-----------|--------------------|----------|
| `#c0392b` | `status/danger-edge` | Danger button border on hover |
| `#e74c3c` | `status/danger`    | Danger button label on hover, dialog error text |
| `#4a7c4a` | `status/ok`        | Sync status when last write succeeded |

---

## Typography

One typeface, one family stack:

```
font-family: 'Georgia', serif;
```

### Scale

| Size  | Weight | Tracking      | Used for |
|-------|--------|---------------|----------|
| 16px  | 400    | letter-spacing 2px, UPPERCASE | Header H1 ("Notepad") |
| 15px  | 400    | —             | Editor body |
| 15px  | 600    | letter-spacing 0.5px | Dialog heading (H3) |
| 14px  | 400    | —             | Dialog body paragraph, dialog input |
| 13px  | 400    | —             | Buttons |
| 12px  | 400    | —             | Word count, page info, dialog hint, dialog error |
| 11px  | 400    | —             | Sync status |

### Line-height

| Context | line-height |
|---------|-------------|
| Editor body | 1.8 |
| Dialog body | 1.5 |
| Everything else | inherits 1.0–1.2 |

---

## Spacing & layout

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

- Max width: `900px` (centered inside container).
- Editor surface `outline: none` — the page itself is the editor; no chrome around the writing area.

### Controls

| Control | Padding | Mobile |
|---------|---------|--------|
| Button | `5px 14px` | `4px 10px` |
| Dialog input | `10px 12px` | unchanged |

---

## Border radius

| Radius | Used for |
|--------|----------|
| `4px`  | Buttons, dialog input |
| `6px`  | Dialog body |

---

## Components

### Header

The page chrome. Logo (H1) on the left, action cluster on the right. Single bottom border (`#2a2a2a`) is the only divider on the page.

States: none — the header is static.

### Button

Five variants. Three states each (default / hover / disabled).

| Variant   | Default                                          | Hover                                          | Notes |
|-----------|--------------------------------------------------|------------------------------------------------|-------|
| `default` | border `#333` · color `#888` · bg transparent    | border `#666` · color `#ccc`                   | The base. All chrome buttons start here. |
| `disabled`| as default + `opacity: 0.3` + `cursor: not-allowed` | (no hover affordance)                       | Used for prev/next when at first page. |
| `danger`  | inherits `default`                               | border `#c0392b` · color `#e74c3c`             | "Clear" button. Hover-only red. |
| `primary` | border `#f4c430` · color `#f4c430` · bg transparent | bg `#f4c430` · color `#000`                  | Modal confirm. Always paired with a default-style cancel. |

All buttons share: `border-radius: 4px`, `padding: 5px 14px`, font 13px, transition `all 0.15s`, family inherits Georgia.

### Status chips

Inline text, no background. Three slots in the header right cluster, in this order (left to right): sync status → word count → page nav.

| Chip            | Color    | Notes |
|-----------------|----------|-------|
| Word count      | `#555`   | "0 words" / "1 word" / "N words" |
| Page info       | `#555`   | "1 / 1" — min-width 60px so jitter is suppressed |
| Sync status     | `#555` (idle) · `#4a7c4a` (ok) · `#c0392b` (error) | 11px, narrower than the others. Hidden on mobile. |

### Dialog (modal)

Native `<dialog>` element with custom styling. Backdrop is `rgba(0,0,0,0.7)`.

Anatomy, top to bottom:
1. **Heading** (H3) — 15px / 600 / `#e0e0e0`, `letter-spacing: 0.5px`, `margin-bottom: 8px`.
2. **Body paragraph** — 14px / 400 / `#999`, `line-height: 1.5`, `margin-bottom: 12px`.
3. **Input** (optional) — see below.
4. **Hint** — 12px / `#777`, with `<strong>` accent rendered in `accent/gold` (600).
5. **Error** — 12px / `#e74c3c`, `min-height: 16px` so the layout doesn't jump when an error appears.
6. **Actions row** — buttons in `.dialog-actions`, gap `8px`, `flex-wrap: wrap`. Each button stretches to `flex: 1` with `min-width: 120px`.

Geometry: `padding: 24px`, `border-radius: 6px`, `border: 1px solid #333`, `max-width: 460px`, `width: calc(100% - 32px)`.

### Dialog input (text)

| State    | Border    | Background |
|----------|-----------|------------|
| Default  | `1px solid #333` | `#111` |
| Focused  | `1px solid #f4c430` | `#111` |

Padding `10px 12px`, font 14px Georgia, color `#e0e0e0`, no `outline` (border is the only focus indicator).

### Editor surface

The writing area itself. `contenteditable`, `max-width: 900px`, `font-size: 15px`, `line-height: 1.8`, `outline: none`. Lives inside the container, which provides the surrounding 48px padding.

---

## Responsive

One breakpoint: `@media (max-width: 768px)`.

What collapses:
- Header padding tightens (`14px 24px` → `10px 14px`); H1 shrinks (`16px` / track `2px` → `13px` / track `1px`).
- Container padding halves (`48px` → `24px`).
- Action cluster gap shrinks (`10px` → `6px`); buttons compact (`5px 14px` → `4px 10px`, font `13px` → `12px`).
- Sync status chip is hidden (room is precious).
- Dialog action buttons stack via `flex-wrap` already in the desktop spec — no extra rules needed.

No tablet breakpoint, no large-desktop adjustment. The design is comfortable from ~360px through any wide screen because the editor caps at 900px regardless.

---

## Out-of-system (intentionally undocumented for now)

Add a section here when we spec these:

- **Animation / motion** — no easings, no durations, no entrance choreography. The only `transition` in the codebase is `all 0.15s` on buttons.
- **Focus rings** — buttons and the editor have no focus indicator. Only the dialog input has one (the gold border).
- **Light theme** — the app is dark-only. If we ever add a toggle, the spec will need a parallel surface/text ramp.
- **Loading & empty states** — the editor's empty state is "no placeholder, just space." If we add real empty states (e.g., "no notes yet"), they need their own treatment.
- **Iconography** — we don't have any. Arrows in nav buttons are literal `←` and `→` glyphs.
