# Design brief: round 2

William's feedback on round 1: the themes changed the concept, and they looked like
"AI slop". In this round, keep the concept: **Snake Forever is played on a late-1990s
Nokia-style candybar phone**, and the game keeps every word it has now. Make it **look
better**.

Each design is one art direction for the same phone and menu. Each one has a specific
real-world reference, and it must look like a careful industrial or graphic designer made
it. Do not print real brand logos (no "NOKIA" text). Use design language only.

## What stays the same

- All text, names, and numbers. Themes must not use `phrases` or `labels` for words.
- Every element and every control. Nothing may be hidden or removed. Every state must
  still be readable: tabs, disabled, maxed, locked keys, pressed keys, selected swatch,
  and focus.
- Game logic. Use CSS, plus `canvas.colors` to recolour the LCD, plus an optional cheap
  `canvas.overlay` for LCD texture (pixel grid, glass reflection). Layout changes are
  allowed through CSS: grid, `order`, position, size, and spacing.

## Layout is in scope

Today the menu panel is on the left and the phone is on the right. A design may arrange
them differently, for example a printed manual beside a phone, or a phone on a desk with
a spec sheet. It must still work from 360 px to 1920 px wide with no horizontal overflow,
and the fullscreen mode (`body.is-fullscreen-mode`) must still work.

## Rules against slop

Do not use:

1. Purple-to-pink or blue-to-purple gradients, or neon glow as decoration.
2. Glassmorphism, `backdrop-filter` blur, or frosted panels.
3. Glow (`box-shadow` with a large blur in an accent colour) on more than one or two
   focal elements. An LCD backlight may glow.
4. Gradients on every surface. Use gradients only where a real material curves: plastic,
   rubber keys, or glass.
5. Emoji or decorative Unicode as ornament.
6. Animated backgrounds, or motion that does not show a change in game state.
7. More than one display typeface and one text typeface. A pixel or LCD face is allowed
   for the LCD only.
8. Random values. Use one spacing scale (4/8/12/16/24/32), one radius system, and one
   border weight system.
9. Low contrast. Body text must meet 4.5:1 contrast.
10. Cards inside cards inside cards. Use rules, spacing, and type to group items.

Do:

- Start from the reference. Copy its real decisions: fascia colour and finish, key shapes
  (rubber keys and the navi key), the LCD's two-tone palette and pixel feel, the label
  typography, and the screen bezel.
- Make the LCD authentic. Use two or three tones only (for example `#c7d9b6` /
  `#43523d`), a crisp pixel look, and optionally a faint pixel grid. It must stay readable.
- Make the menu panel read like a real artefact that belongs with the phone: a quick
  reference card, a manual page, a spec sheet, or the phone's own menu UI.
- Use a strict palette: neutrals plus one or two accents with meaning.

## The five directions

| id | Name | Designer | Reference |
| --- | --- | --- | --- |
| `navy-brick` | Navy Brick | Claude | The classic 2000 navy candybar: dark navy fascia, grey-silver rubber keypad, a wide "navi" key with a C key, a green-backlit monochrome LCD. The menu is the phone's own menu UI: list rows, softkey bar, scroll bar. |
| `silver-slim` | Silver Slim | Claude | The premium compact phone of 1999–2001: brushed silver and graphite, an amber or white backlit LCD, small precise keys. The menu is a printed product spec sheet with Swiss typography. |
| `clear-cover` | Clear Cover | Claude | A 1999 translucent swap-cover: frosted coloured plastic that shows the circuit board, iMac-era colours, rubbery keys. The menu is the cover's retail card. |
| `business-slate` | Business Slate | Codex | The 1998–2000 business phone: charcoal and gunmetal, a dark LCD with a cool white or green backlight, a rocker key, a serious and quiet look. The menu is a pocket quick-reference guide. |
| `retail-box` | Retail Box | Codex | The original product packaging and printed user manual: the phone sits in a box insert, the menu is a manual page with numbered steps and line diagrams, a two-colour print palette. |
