# Theme redesigns

Snake Forever has ten themes: five from round 3 and five retro handsets from round 4. **Office Charcoal** is the official
theme and the default. The theme picker is off (`picker: false` in `index.html`), and a stored
choice from the old picker is ignored. Open `?theme=<id>` to see another theme, for example
`?theme=original`.

| id | Name | Designer |
| --- | --- | --- |
| `clear-cover-2` | Clear Cover II | Claude |
| `amber-graphite` | Amber Graphite | Claude |
| `night-green` | Night Green | Claude |
| `oxblood` | Oxblood | Codex |
| `carbon` | Carbon | Codex |
| `brick-navy` | Brick Navy | Claude |
| `office-charcoal` | Office Charcoal | Claude |
| `signal-red` | Signal Red | Claude |
| `pebble` | Pebble | Claude |
| `taxi-yellow` | Taxi Yellow | Claude |

Round 3 (William's feedback: dark, minimal menus with strong contrast, snake colours that work, scanlines instead of a pixel grid). Clear Cover II improves his favourite (Clear Cover); the other four are new: Amber Graphite and Night Green (Claude), and Oxblood and Carbon (Codex). Claude's three come from one template in `themes/_build`. `contrastingEyeColor` now reads the themed palette. The round 2 designs were removed. Every design keeps the game's words. See `DESIGN-BRIEF.md` for the rules against slop.

Round 4 (William's feedback: "less shiney and techno more retro nokia"). Five retro handsets start from Clear Cover II and replace its gloss with matte plastic, flat rubber keys, and a two-tone dot-matrix LCD with no glow. Each one is a different period handset with its own body shape, key shapes, LCD tone, and menu treatment:

- **Brick Navy**: a thick navy brick with a silver-grey screen surround, pale grey keys, and a mint LCD. The menu is the phone's own menu screen.
- **Office Charcoal**: a tall charcoal slab with a stub antenna, oval keys, blue-grey function keys, and a yellow-green LCD. The menu is a pocket reference card with underlined tabs.
- **Signal Red**: a matte red swap cover with round black keys and a plain grey LCD. The menu is warm black with one red rule.
- **Pebble**: a small stone-coloured pebble with square graphite keys and a cool grey LCD. The menu has outlined tabs and sand buttons.
- **Taxi Yellow**: a square-shouldered yellow body with black keys and a cream LCD. The menu is black with a yellow band and block tabs.

The retro themes come from `themes/_build/build_retro.py` and the same template. They do not remap the snake colours that the player selects. `themes/themes.test.js` checks their contrast, the absence of gloss and glow, and their registration in `index.html`.

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
  - the palette in `lightenColor` and `contrastingEyeColor`
  - the redraw on theme change
- The Original theme must look and read exactly as before. The Playwright tests run against Original.
- `npm run check` must pass, including `themes/themes.test.js`.

## Theme Lab (one server for both games)

```
npm run theme-lab
```

This opens <http://localhost:8090>. The index lists both games and every theme. `/sweep/` serves `C:\Code\IdleSweep-redesign`, and `/snake/` serves the shipped checkout at `C:\Code\IdleSnake`. You can set `SWEEP_ROOT` and `SNAKE_ROOT` to use other folders. Each game's own `npm run serve` also works; use the picker there.
