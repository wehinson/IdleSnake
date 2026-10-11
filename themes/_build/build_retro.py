"""Build the five retro handset themes (round 4) from the shared template plus a palette each.

William's direction: "less shiney and techno more retro nokia". Each theme starts from the
Clear Cover II system in snake-template.css, then replaces its gloss with matte plastic,
plain rubber keys, and a dot-matrix LCD. Run: python themes/_build/build_retro.py
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
THEMES = HERE.parent
TEMPLATE = (HERE / "snake-template.css").read_text(encoding="utf-8")

BODY = ["#29391f", "#32204f", "#16465a", "#176052", "#843b2f", "#a55b25", "#702c57", "#252a32"]
HEAD = ["#182413", "#583b83", "#267b91", "#2d8b68", "#b3483d", "#b0802d", "#9b477e", "#596474"]


def rgb(hex_color):
    value = hex_color.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, amount):
    """Blend hex colour a toward hex colour b by amount (0..1)."""
    return "#" + "".join(f"{round(x + (y - x) * amount):02x}" for x, y in zip(rgb(a), rgb(b)))


def rgba(hex_color, alpha):
    r, g, b = rgb(hex_color)
    return f"rgba({r}, {g}, {b}, {alpha})"


def lcd_colors(lcd, ink):
    """A two-tone LCD: the game's screen literals become steps between glass and ink.
    Snake colours the player picked are not remapped; only the default head is the ink."""
    return {
        "#9cac77": lcd,
        "#182413": ink,
        "#e7e1c5": mix(lcd, "#ffffff", 0.55),
        "#132218": mix(ink, "#000000", 0.2),
        "#1b2b20": mix(ink, lcd, 0.06),
        "#1c2c22": mix(ink, lcd, 0.1),
        "#4b562f": mix(ink, lcd, 0.38),
        "#708b59": mix(ink, lcd, 0.68),
        "#344336": mix(ink, lcd, 0.26),
    }


def overlay_js(ink, grid, rows, shade):
    """A dot-matrix LCD: faint pixel rows (and columns), and the shadow the bezel casts
    on the top and left of the glass. No glow."""
    columns = f"""
        for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);""" if grid else ""
    return f"""function overlay(ctx, canvas) {{
        const w = canvas.width;
        const h = canvas.height;
        const step = Math.max(3, Math.round(w / 126));
        ctx.save();
        ctx.fillStyle = "{rgba(ink, rows)}";
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);{columns}
        ctx.fillStyle = "{rgba(ink, shade)}";
        ctx.fillRect(0, 0, w, step);
        ctx.fillRect(0, step, step, h - step);
        ctx.restore();
      }}"""


# Shared by all five: remove the gloss, the glow, and the grid; keep the functions.
COMMON = """
/* ---------- retro handset: matte plastic, plain controls, dot-matrix LCD ---------- */

html[data-theme="@ID@"] .menu-panel {
  background: var(--s-menu);
  box-shadow: none;
}

html[data-theme="@ID@"] .screen-frame {
  box-shadow: none;
}

/* The LCD face is for the things the phone itself would draw */
html[data-theme="@ID@"] :is(.stat-label, .status-strip strong, .grid-select, #stateText, .ready-start-prompt, .screen-hint) {
  font-family: var(--s-lcd-font);
}

html[data-theme="@ID@"] .stat-label {
  font-size: var(--s-lcd-label-size);
  font-weight: 400;
  letter-spacing: 0.04em;
}

html[data-theme="@ID@"] .status-strip strong {
  font-size: var(--s-lcd-size);
  font-weight: 400;
  letter-spacing: 0.02em;
}

html[data-theme="@ID@"] #stateText,
html[data-theme="@ID@"] .ready-start-prompt {
  font-weight: 400;
}

html[data-theme="@ID@"] .screen-plate {
  border-width: 1px;
  border-radius: 2px;
}

html[data-theme="@ID@"] .screen-hint {
  font-size: var(--s-lcd-label-size);
  font-weight: 400;
  letter-spacing: 0.04em;
}

html[data-theme="@ID@"] .egg-shape {
  background: var(--s-egg);
}

html[data-theme="@ID@"] .nursery-grid {
  border-width: 4px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

html[data-theme="@ID@"] .habitat-capacity-tooltip {
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}

/* Rubber keys: one flat colour, a hard edge below, no highlight */
html[data-theme="@ID@"] :is(.nav-key, .action-key, .phone-key),
html[data-theme="@ID@"] :is(.nav-key, .action-key, .phone-key):focus-visible {
  box-shadow: 0 2px 0 var(--s-key-base);
}

html[data-theme="@ID@"] #startButton {
  box-shadow: inset 0 -4px 0 -1px var(--s-go), 0 2px 0 var(--s-key-base);
}

html[data-theme="@ID@"] #resetButton {
  box-shadow: inset 0 -4px 0 -1px var(--s-stop), 0 2px 0 var(--s-key-base);
}

html[data-theme="@ID@"] :is(.nav-key:active, .nav-key.is-pressed, .action-key:active, .action-key.is-active) {
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.4);
  filter: brightness(0.9);
  transform: translateY(1px);
}

html[data-theme="@ID@"] .minigame-key.is-locked {
  box-shadow: none;
}

html[data-theme="@ID@"] .phone-nav.is-large-dpad {
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
}

html[data-theme="@ID@"] .phone-brand {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.16em;
}
"""

# The integration rules that every theme carries (keypad focus and the fullscreen menu width).
TAIL = """
/* Keep the current keypad focus and fullscreen menu rules in every theme. */
html[data-theme="@ID@"] .phone-key:focus,
html[data-theme="@ID@"] .phone-key:focus-visible { outline: none; }
@media (min-width: 801px) {
  html[data-theme="@ID@"] body.is-fullscreen-mode .app-layout.has-fullscreen-option {
    grid-template-columns: minmax(0, 450px) minmax(0, 1fr);
  }
}
"""


def build(theme_id, name, note, lcd_font, font_url, palette, lcd, ink, overlay, extras):
    colors = lcd_colors(lcd, ink)
    js = f"""/* {name}: {note} */
ThemeKit.register({{
  id: "{theme_id}",
  name: "{name}",
  author: "Claude",
  fonts: "{font_url}",
  canvas: {{
    colors: {json.dumps(colors, indent=6)[:-1]}    }},
    fonts: {{ "Courier New": "{lcd_font}" }},
    scanlines: false,
    // A dot-matrix LCD with a bezel shadow; no glow.
    overlay: {overlay},
  }},
}});
"""
    (THEMES / theme_id).mkdir(exist_ok=True)
    (THEMES / theme_id / "theme.js").write_text(js, encoding="utf-8", newline="\n")

    lines = [f'html[data-theme="{theme_id}"] {{']
    lines += [f"  --s-{k}: {v};" for k, v in palette.items()]
    lines.append("}")
    css = "\n".join(lines) + "\n\n" + TEMPLATE + "\n" + COMMON.strip() + "\n\n" + extras.strip() + "\n"
    css += "\n/* Swatch previews show the colour the LCD draws */\n"
    for sw in BODY + HEAD:
        css += f'html[data-theme="@ID@"] .color-swatch[data-color="{sw}"] {{\n  background: {colors.get(sw, sw)};\n}}\n\n'
    css = css.rstrip() + "\n" + TAIL
    header = f"/* {name} (Claude)\n   {note} */\n\n"
    (THEMES / theme_id / "theme.css").write_text(header + css.replace("@ID@", theme_id), encoding="utf-8", newline="\n")
    print("wrote", theme_id)


def palette(font, lcd_font, lcd_size, lcd_label_size, lcd, ink, **values):
    """The template's variables. LCD tones come from the glass and ink colours."""
    base = {
        "font": font,
        "lcd-font": lcd_font,
        "lcd-size": lcd_size,
        "lcd-label-size": lcd_label_size,
        "grid": "transparent",
        "lcd": lcd,
        "lcd-ink": ink,
        "lcd-dim": mix(ink, lcd, 0.3),
        "lcd-glow": "inset 0 1px 2px " + rgba(ink, 0.3),
        "seed": mix(ink, lcd, 0.12),
        "key-highlight": "transparent",
    }
    base.update({k.rstrip("_").replace("_", "-"): v for k, v in values.items()})
    return base


VT323 = '"VT323", "Courier New", monospace'
PIXELIFY = '"Pixelify Sans", "Courier New", monospace'
DOTGOTHIC = '"DotGothic16", "Courier New", monospace'


# ---------- Brick Navy ----------
# The navy candybar of 2000: a thick rounded brick, a silver-grey screen surround,
# pale grey rubber keys, and a mint LCD. The menu is the phone's own menu screen.
build(
    "brick-navy", "Brick Navy",
    "The navy candybar of 2000: a thick matte brick with a silver-grey screen surround, pale\n   grey rubber keys, and a mint dot-matrix LCD. The menu is the phone's own menu screen: an\n   inverted title bar, square tabs, and plain ruled rows.",
    "VT323", "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=VT323&display=swap",
    palette(
        '"Archivo", "Helvetica Neue", Arial, sans-serif', VT323, "clamp(1rem, 4.6vw, 1.25rem)", "0.8125rem",
        "#c7f0d8", "#2f3d2b",
        page="#10131b", menu="#181c27", raise_="#222838", raise_2="#2b3245",
        line="#2a3042", line_strong="#444d66",
        text="#edf0f4", muted="#a9b1c2", faint="#69728a",
        accent="#c7f0d8", accent_ink="#18261d", accent_text="#c7f0d8",
        button="#c7f0d8", button_ink="#18261d", button_hover="#dcf7e6",
        radius_panel="6px", radius_box="3px", radius_pill="2px", radius_button="3px",
        c1="#e6c267", c2="#a9d6a0", c3="#9db9e0",
        stop="#d2604f", stop_text="#f0907f", go="#5fae6a", egg="#eef4e4",
        nursery_bg="#c7f0d8", nursery_ink="#2f3d2b", nursery_frame="#2b3245",
        lens="#b9bec6", hint="#2b3040", brand="#d4d9e6",
        key_bg="#c9cdd4", key_border="#161a26", key_base="#12151f", key_ink="#1d2540",
        nav_bg="#dfe2e7", nav_ink="#1d2540",
        key_locked="#39415c", key_locked_border="#1c2132", key_locked_ink="#aab2c8",
        dpad_well="#1f2538",
    ),
    "#c7f0d8", "#2f3d2b",
    overlay_js("#2f3d2b", True, 0.05, 0.14),
    """
/* ---------- the navy brick ---------- */

html[data-theme="@ID@"] .phone-shell {
  padding: 18px 18px 24px;
  border: 2px solid #1b2033;
  border-radius: 52px 52px 60px 60px / 40px 40px 68px 68px;
  background: linear-gradient(90deg, #2a3150, #333b5e 18% 82%, #2a3150);
  box-shadow: 0 14px 0 -8px rgba(0, 0, 0, 0.35), 0 18px 28px -14px rgba(0, 0, 0, 0.6);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: #171b2b;
  filter: none;
}

/* The silver-grey surround curves down under the LCD */
html[data-theme="@ID@"] .screen-frame {
  border: 1px solid #7d838e;
  border-radius: 12px 12px 40px 40px / 12px 12px 22px 22px;
}

/* A dark rim around the glass; shadows only, so the layout does not move */
html[data-theme="@ID@"] .status-strip {
  box-shadow: 0 0 0 2px #20242c;
}

html[data-theme="@ID@"] .screen-bezel {
  box-shadow: var(--s-lcd-glow), 0 0 0 2px #20242c;
}

html[data-theme="@ID@"] .is-fullscreen-mode :is(.status-strip, .screen-bezel) {
  box-shadow: none;
}

html[data-theme="@ID@"] .phone-key {
  border-radius: 10px / 50%;
}

html[data-theme="@ID@"] .action-key {
  border-radius: 12px / 50%;
}

html[data-theme="@ID@"] .nav-up {
  border-radius: 20px 20px 8px 8px;
}

html[data-theme="@ID@"] .nav-down {
  border-radius: 8px 8px 20px 20px;
}

html[data-theme="@ID@"] .nav-left {
  border-radius: 16px 8px 8px 16px;
}

html[data-theme="@ID@"] .nav-right {
  border-radius: 8px 16px 16px 8px;
}

/* The menu is the phone's own menu screen */
html[data-theme="@ID@"] .menu-panel {
  border: 2px solid var(--s-line-strong);
}

html[data-theme="@ID@"] .menu-panel h1 {
  margin: -20px -20px 16px;
  padding: 8px 20px;
  background: var(--s-accent);
  color: var(--s-accent-ink);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

html[data-theme="@ID@"] .menu-stat {
  border: 1px solid var(--s-line-strong);
  background: transparent;
}

html[data-theme="@ID@"] .menu-stat strong {
  color: var(--s-accent-text) !important;
  font-family: var(--s-lcd-font);
  font-size: clamp(2.75rem, 10vw, 3.5rem);
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1;
}

html[data-theme="@ID@"] .menu-tabs {
  gap: 0;
  padding: 0;
  border: 1px solid var(--s-line-strong);
  background: transparent;
}

html[data-theme="@ID@"] .menu-tab {
  border-radius: 0;
}

html[data-theme="@ID@"] .menu-tab + .menu-tab {
  border-left: 1px solid var(--s-line-strong);
}

html[data-theme="@ID@"] .color-swatch,
html[data-theme="@ID@"] .color-swatch::after {
  border-radius: 2px;
}

html[data-theme="@ID@"] :is(.personalization-back, .mobile-control-toggle) {
  border-radius: 3px;
}
""",
)

# ---------- Office Charcoal ----------
# The business phone of 1998: a tall charcoal slab with a stub antenna, oval keys,
# one pale blue-grey function key, and a yellow-green LCD.
build(
    "office-charcoal", "Office Charcoal",
    "The business phone of 1998: a tall charcoal slab with a stub antenna, dark oval keys,\n   blue-grey function keys, and a yellow-green LCD with pixel rows. The menu is a pocket\n   reference card: underlined tabs, small capitals, and pale solid buttons.",
    "DotGothic16", "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=DotGothic16&display=swap",
    palette(
        '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif', DOTGOTHIC, "clamp(0.8rem, 3.6vw, 0.95rem)", "0.625rem",
        "#c8d5a8", "#222c14",
        page="#111213", menu="#1a1c1d", raise_="#26292b", raise_2="#303436",
        line="#2e3133", line_strong="#4a4f52",
        text="#eceeed", muted="#a8adad", faint="#6a7071",
        accent="#9fb4c7", accent_ink="#111a22", accent_text="#b4c7d8",
        button="#d9dddc", button_ink="#16191a", button_hover="#f2f4f3",
        radius_panel="2px", radius_box="2px", radius_pill="2px", radius_button="2px",
        c1="#d8b96a", c2="#c8d5a8", c3="#9fb4c7",
        stop="#c9584a", stop_text="#eb8b7d", go="#6fa85f", egg="#e9ecd9",
        nursery_bg="#c8d5a8", nursery_ink="#222c14", nursery_frame="#303436",
        lens="#0e0f10", hint="#a8adad", brand="#b8bdbd",
        key_bg="#2a2d2f", key_border="#0c0d0e", key_base="#08090a", key_ink="#eceeed",
        nav_bg="#9fb4c7", nav_ink="#111a22",
        key_locked="#1f2223", key_locked_border="#101112", key_locked_ink="#6f7576",
        dpad_well="#1c1e20",
    ),
    "#c8d5a8", "#222c14",
    overlay_js("#222c14", False, 0.07, 0.16),
    """
/* ---------- the charcoal slab with a stub antenna ---------- */

html[data-theme="@ID@"] .phone-shell {
  padding: 20px 18px 22px;
  border: 2px solid #1a1c1d;
  border-radius: 34px 34px 26px 26px / 28px 28px 22px 22px;
  background: linear-gradient(90deg, #36393b, #44484a 14% 86%, #36393b);
  box-shadow: 0 14px 0 -8px rgba(0, 0, 0, 0.4), 0 18px 28px -14px rgba(0, 0, 0, 0.65);
}

html[data-theme="@ID@"] .phone-shell::before {
  content: "";
  top: -18px;
  right: 34px;
  width: 22px;
  height: 58px;
  border: 2px solid #1a1c1d;
  border-radius: 8px 8px 4px 4px;
  background: #36393b;
  box-shadow: none;
}

html[data-theme="@ID@"] .speaker-slot {
  width: 52px;
  height: 10px;
  border-radius: 5px;
  background: repeating-linear-gradient(90deg, #111213 0 4px, transparent 4px 8px);
  filter: none;
}

html[data-theme="@ID@"] .screen-frame {
  padding: 10px;
  border: 2px solid #5a5f62;
  border-radius: 6px;
}

/* Oval number keys; the function keys are the one pale colour on the phone */
html[data-theme="@ID@"] .phone-key {
  border-radius: 999px / 70%;
}

html[data-theme="@ID@"] .action-key {
  border-radius: 6px;
  background: var(--s-nav-bg);
  color: var(--s-nav-ink);
}

html[data-theme="@ID@"] :is(.nav-up, .nav-down, .nav-left, .nav-right) {
  border-radius: 6px;
}

/* The default direction keys are round; the large D-pad keeps its own shape */
html[data-theme="@ID@"] .phone-nav:not(.is-large-dpad) :is(.nav-up, .nav-down, .nav-left, .nav-right) {
  justify-self: center;
  border-radius: 50%;
}

html[data-theme="@ID@"] .phone-nav:not(.is-large-dpad) :is(.nav-up, .nav-down) {
  width: 42px;
  height: 42px;
}

html[data-theme="@ID@"] .phone-nav:not(.is-large-dpad) :is(.nav-left, .nav-right) {
  width: 40px;
  height: 40px;
}

/* The fullscreen key is a full circle, not an oval */
html[data-theme="@ID@"] .fullscreen-mode-button {
  border-radius: 50%;
}

/* The menu is a pocket reference card */
html[data-theme="@ID@"] .menu-panel {
  border: 1px solid var(--s-line-strong);
  border-top: 4px solid var(--s-accent);
}

html[data-theme="@ID@"] .menu-panel h1 {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--s-muted);
}

html[data-theme="@ID@"] .menu-stat {
  padding: 0 0 12px;
  border-bottom: 1px solid var(--s-line-strong);
  background: transparent;
}

html[data-theme="@ID@"] .menu-stat strong {
  font-weight: 500;
}

html[data-theme="@ID@"] .menu-tabs {
  gap: 0;
  padding: 0;
  border-bottom: 1px solid var(--s-line-strong);
  background: transparent;
}

html[data-theme="@ID@"] .menu-tab {
  padding: 8px 4px 10px;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

html[data-theme="@ID@"] .menu-tab.is-active,
html[data-theme="@ID@"] .menu-tab[aria-selected="true"] {
  background: transparent;
  box-shadow: inset 0 -3px 0 var(--s-accent);
  color: var(--s-text);
}

html[data-theme="@ID@"] .color-swatch,
html[data-theme="@ID@"] .color-swatch::after {
  border-radius: 2px;
}

html[data-theme="@ID@"] :is(.personalization-back, .mobile-control-toggle) {
  border-radius: 2px;
}
""",
)

# ---------- Signal Red ----------
# The swap cover of 1999 in matte red: a soft rounded body, black rubber keys with white
# numerals, a black lens, and a plain grey LCD that looks unlit.
build(
    "signal-red", "Signal Red",
    "The swap cover of 1999 in matte signal red: a soft rounded body, black rubber keys with\n   white numerals, and a plain grey LCD that looks unlit. The menu is warm black with one\n   red rule, block tabs, and off-white buttons.",
    "Pixelify Sans", "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&family=Pixelify+Sans:wght@400;500&display=swap",
    palette(
        '"Work Sans", "Helvetica Neue", Arial, sans-serif', PIXELIFY, "clamp(0.85rem, 3.8vw, 1rem)", "0.6875rem",
        "#cfd3c4", "#24281f",
        page="#110e0d", menu="#1a1615", raise_="#272120", raise_2="#322a28",
        line="#30292a", line_strong="#51474a",
        text="#f3eeea", muted="#b5aaa6", faint="#766b68",
        accent="#c8372f", accent_ink="#ffffff", accent_text="#f08a7c",
        button="#f3eeea", button_ink="#1a1615", button_hover="#ffffff",
        radius_panel="12px", radius_box="6px", radius_pill="4px", radius_button="6px",
        c1="#e0b563", c2="#b7c9a4", c3="#a9bfd4",
        stop="#c8372f", stop_text="#f08a7c", go="#6aa862", egg="#f1ecdf",
        nursery_bg="#cfd3c4", nursery_ink="#24281f", nursery_frame="#322a28",
        lens="#121212", hint="#f3d9d5", brand="#ffe9e5",
        key_bg="#1d1d1e", key_border="#0a0a0a", key_base="#701a16", key_ink="#f3eeea",
        nav_bg="#1d1d1e", nav_ink="#f3eeea",
        key_locked="#8e2823", key_locked_border="#701a16", key_locked_ink="#f0c4be",
        dpad_well="#8e2823",
    ),
    "#cfd3c4", "#24281f",
    overlay_js("#24281f", True, 0.04, 0.12),
    """
/* ---------- the matte red swap cover ---------- */

html[data-theme="@ID@"] .phone-shell {
  padding: 18px 20px 26px;
  border: 2px solid #7a1e19;
  border-radius: 60px 60px 48px 48px / 46px 46px 44px 44px;
  background: linear-gradient(90deg, #a92b25, #ba322b 16% 84%, #a92b25);
  box-shadow: 0 14px 0 -8px rgba(0, 0, 0, 0.35), 0 18px 28px -14px rgba(0, 0, 0, 0.6);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 30px;
  height: 8px;
  border-radius: 4px;
  background: #701a16;
  filter: none;
}

html[data-theme="@ID@"] .screen-frame {
  border: 2px solid #0a0a0a;
  border-radius: 16px 16px 26px 26px;
}

/* Round black keys; the selector keys are wide black bars */
html[data-theme="@ID@"] .phone-key {
  border-radius: 999px;
}

html[data-theme="@ID@"] .action-key {
  border-radius: 999px;
}

html[data-theme="@ID@"] :is(.nav-up, .nav-down, .nav-left, .nav-right) {
  border-radius: 999px;
}

/* A warm black menu with one red rule */
html[data-theme="@ID@"] .menu-panel h1 {
  padding-bottom: 8px;
  border-bottom: 3px solid var(--s-accent);
  font-size: 1.5rem;
  letter-spacing: 0;
}

html[data-theme="@ID@"] .menu-section-mark,
html[data-theme="@ID@"] .menu-panel :is(.upgrade-next, .egg-progress-rate) {
  color: var(--s-accent-text) !important;
}

html[data-theme="@ID@"] .menu-panel :is(button, select, input):focus-visible {
  outline-color: var(--s-text);
}

html[data-theme="@ID@"] .growth-bar span {
  background: var(--s-text);
}
""",
)

# ---------- Pebble ----------
# The compact phone of 2000 in warm stone plastic: a small pebble with graphite keys,
# a cool grey-blue LCD, and a graphite menu with outlined tabs and sand buttons.
build(
    "pebble", "Pebble",
    "The compact phone of 2000 in warm stone plastic: a small rounded pebble with square\n   graphite keys and a cool grey LCD. The menu is graphite with outlined tabs, sand\n   buttons, and soft square corners.",
    "VT323", "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=VT323&display=swap",
    palette(
        '"Barlow", "Helvetica Neue", Arial, sans-serif', VT323, "clamp(1rem, 4.6vw, 1.25rem)", "0.8125rem",
        "#c5d1cd", "#1c2a2b",
        page="#131211", menu="#1c1b19", raise_="#282623", raise_2="#33302c",
        line="#312f2b", line_strong="#55514a",
        text="#f1eee7", muted="#b0aa9d", faint="#716c61",
        accent="#d2c4a2", accent_ink="#231e12", accent_text="#dfd3b6",
        button="#d2c4a2", button_ink="#231e12", button_hover="#e4d9bd",
        radius_panel="10px", radius_box="8px", radius_pill="8px", radius_button="8px",
        c1="#d9b56a", c2="#aecba6", c3="#a8c3cf",
        stop="#c9594a", stop_text="#ec8d7e", go="#69a763", egg="#efeadb",
        nursery_bg="#c5d1cd", nursery_ink="#1c2a2b", nursery_frame="#33302c",
        lens="#191a1b", hint="#cfd6d4", brand="#4b463c",
        key_bg="#3b3b3c", key_border="#1b1b1c", key_base="#8d8676", key_ink="#f1eee7",
        nav_bg="#4a4a4b", nav_ink="#f1eee7",
        key_locked="#a59e8f", key_locked_border="#8d8676", key_locked_ink="#4b463c",
        dpad_well="#a59e8f",
    ),
    "#c5d1cd", "#1c2a2b",
    overlay_js("#1c2a2b", True, 0.035, 0.1),
    """
/* ---------- the stone pebble ---------- */

html[data-theme="@ID@"] .phone-shell {
  width: min(94vw, 310px);
  padding: 20px 20px 24px;
  border: 2px solid #8d8676;
  border-radius: 64px 64px 64px 64px / 48px 48px 56px 56px;
  background: linear-gradient(90deg, #b4ad9e, #c2bbac 16% 84%, #b4ad9e);
  box-shadow: 0 14px 0 -8px rgba(0, 0, 0, 0.35), 0 18px 28px -14px rgba(0, 0, 0, 0.6);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle, #4b463c 0 2px, transparent 2.5px) 0 0 / 6px 6px;
  filter: none;
}

html[data-theme="@ID@"] .screen-frame {
  padding: 10px;
  border: 1px solid #0c0c0d;
  border-radius: 20px;
}

/* Small square keys with a tight radius */
html[data-theme="@ID@"] .phone-key {
  border-radius: 6px;
}

html[data-theme="@ID@"] .action-key {
  border-radius: 6px;
}

html[data-theme="@ID@"] .nav-up {
  border-radius: 14px 14px 6px 6px;
}

html[data-theme="@ID@"] .nav-down {
  border-radius: 6px 6px 14px 14px;
}

html[data-theme="@ID@"] .nav-left {
  border-radius: 14px 6px 6px 14px;
}

html[data-theme="@ID@"] .nav-right {
  border-radius: 6px 14px 14px 6px;
}

/* Outlined tabs on a graphite menu */
html[data-theme="@ID@"] .menu-panel h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

html[data-theme="@ID@"] .menu-stat {
  border: 1px solid var(--s-line-strong);
  background: transparent;
}

html[data-theme="@ID@"] .menu-tabs {
  gap: 6px;
  padding: 0;
  background: transparent;
}

html[data-theme="@ID@"] .menu-tab {
  border: 1px solid var(--s-line-strong);
}

html[data-theme="@ID@"] .menu-tab.is-active,
html[data-theme="@ID@"] .menu-tab[aria-selected="true"] {
  border-color: var(--s-accent);
  background: var(--s-raise-2);
  color: var(--s-accent-text);
}

html[data-theme="@ID@"] .color-swatch,
html[data-theme="@ID@"] .color-swatch::after {
  border-radius: 4px;
}

html[data-theme="@ID@"] :is(.personalization-back, .mobile-control-toggle) {
  border-radius: 6px;
}
""",
)

# ---------- Taxi Yellow ----------
# The bright youth phone of 1999 in matte yellow: a square-shouldered body, black keys,
# a black screen window, and a warm cream LCD. The menu is black with yellow blocks.
build(
    "taxi-yellow", "Taxi Yellow",
    "The bright youth phone of 1999 in matte yellow: a square-shouldered body, black keys with\n   yellow numerals, and a warm cream LCD. The menu is black with a yellow top band, block\n   tabs, capital headings, and square yellow buttons.",
    "Pixelify Sans", "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Pixelify+Sans:wght@400;500&display=swap",
    palette(
        '"Rubik", "Helvetica Neue", Arial, sans-serif', PIXELIFY, "clamp(0.85rem, 3.8vw, 1rem)", "0.6875rem",
        "#e2dcae", "#2e2a12",
        page="#0f0f0d", menu="#181816", raise_="#242421", raise_2="#2e2e2a",
        line="#2c2c28", line_strong="#4c4c45",
        text="#f4f2e8", muted="#b0ad9c", faint="#6f6d60",
        accent="#e6b422", accent_ink="#1c1603", accent_text="#f0c84e",
        button="#e6b422", button_ink="#1c1603", button_hover="#f2c744",
        radius_panel="0px", radius_box="0px", radius_pill="0px", radius_button="0px",
        c1="#e6b422", c2="#b5cc9a", c3="#a5c0d6",
        stop="#cf5a45", stop_text="#f08f7a", go="#6cab5f", egg="#f3eed6",
        nursery_bg="#e2dcae", nursery_ink="#2e2a12", nursery_frame="#2e2e2a",
        lens="#141412", hint="#f4e7b0", brand="#3a2d03",
        key_bg="#1c1c1a", key_border="#0a0a09", key_base="#9c7910", key_ink="#f0c84e",
        nav_bg="#1c1c1a", nav_ink="#f0c84e",
        key_locked="#c2981a", key_locked_border="#9c7910", key_locked_ink="#3a2d03",
        dpad_well="#c2981a",
    ),
    "#e2dcae", "#2e2a12",
    overlay_js("#2e2a12", False, 0.05, 0.12),
    """
/* ---------- the matte yellow body ---------- */

html[data-theme="@ID@"] .phone-shell {
  padding: 18px 18px 24px;
  border: 2px solid #9c7910;
  border-radius: 28px 28px 44px 44px / 24px 24px 52px 52px;
  background: linear-gradient(90deg, #d6a71c, #e3b223 14% 86%, #d6a71c);
  box-shadow: 0 14px 0 -8px rgba(0, 0, 0, 0.4), 0 18px 28px -14px rgba(0, 0, 0, 0.65);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 40px;
  height: 4px;
  border-radius: 0;
  background: #3a2d03;
  box-shadow: 0 7px 0 #3a2d03;
  margin-bottom: 7px;
  filter: none;
}

/* A black screen window with a square cut */
html[data-theme="@ID@"] .screen-frame {
  border: 0;
  border-radius: 10px 10px 4px 4px;
}

html[data-theme="@ID@"] .phone-key {
  border-radius: 4px;
}

html[data-theme="@ID@"] .action-key {
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
}

html[data-theme="@ID@"] :is(.nav-up, .nav-down, .nav-left, .nav-right) {
  border-radius: 4px;
}

html[data-theme="@ID@"] .is-fullscreen-mode .phone-shell {
  border-radius: 12px;
}

/* A black menu with a yellow band and block tabs */
html[data-theme="@ID@"] .menu-panel {
  border: 0;
  border-top: 8px solid var(--s-accent);
}

html[data-theme="@ID@"] .menu-panel h1 {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

html[data-theme="@ID@"] .menu-stat {
  border-left: 4px solid var(--s-accent);
}

html[data-theme="@ID@"] .menu-tabs {
  gap: 2px;
  padding: 0;
  background: transparent;
}

html[data-theme="@ID@"] .menu-tab {
  background: var(--s-raise);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

html[data-theme="@ID@"] .menu-panel :is(button:not(.menu-tab):not(.candidate-list-item), .upgrade-button) {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

html[data-theme="@ID@"] .color-swatch,
html[data-theme="@ID@"] .color-swatch::after {
  border-radius: 0;
}

html[data-theme="@ID@"] :is(.personalization-back, .mobile-control-toggle, .broodline-card) {
  border-radius: 0;
}
""",
)
