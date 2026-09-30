# Theme redesigns

This branch (`working-redesign`) holds five full reskins of Snake Forever. Use the
theme picker at the bottom-left of the page to switch between them. You can also
open `?theme=<id>`. **Original** is the default, and it is unchanged.

| id | Name | Designer |
| --- | --- | --- |
| `koi-garden` | Koi Garden | Claude |
| `neon-drive` | Neon Drive | Claude |
| `iron-rail` | Iron Rail | Claude |
| `dragon-codex` | Dragon Codex | Codex |
| `polar-sled` | Polar Sled | Codex |

## How a theme works

A theme changes only presentation. It never changes session state, engine data, or save data.

- `themes/theme-kit.js` is shared with the IdleSweep redesign. It does these things:
  - It remaps display text: DOM text nodes, the `title`, `aria-label`, `placeholder`, and `alt` attributes, and canvas `fillText`.
  - It remaps literal canvas colours, including their alpha, and canvas fonts.
  - It sets `<html data-theme="<id>">`, loads the theme's Google Fonts, and draws the picker.
- `themes/<id>/theme.js` calls `ThemeKit.register({...})` with these fields:
  - `id`, `name`, `author`, `title`
  - `fonts`: a Google Fonts CSS URL
  - `phrases`: `{ "Original text": "Themed text" }`. Matches are whole words and longest first. UPPERCASE and Capitalized variants of lowercase keys are added automatically. Put Title-case keys before lowercase keys.
  - `labels` (optional): `{ "#selector": "inner HTML" }` for fixed elements.
  - `canvas`: `{ colors: { "#9cac77": "#hex", ... }, fonts: { "Courier New": "Family" }, scanlines: true|false, overlay(ctx, canvas, metrics, strength) }`
    - `colors` remaps every canvas literal. An `rgba(r, g, b, a)` literal is keyed by its rgb part and keeps its alpha.
    - `overlay` is painted last on each frame. Use it for vignettes, paper grain, glow, and similar effects.
- `themes/<id>/theme.css`: **every selector must start with `html[data-theme="<id>"]`**. `npm test` checks this.

## Rules

- Do not edit `game.js`, `engine/**`, or `styles.css` for a theme. The only theme hooks in `game.js` are:
  - the overlay and scanline option in `drawScanlines`
  - the theme id in `staticLayerKey`
  - the palette in `lightenColor`
  - the redraw on theme change
- The Original theme must look and read exactly as before. The Playwright tests run against Original.
- `npm run check` must pass, including `themes/themes.test.js`.
