"""Build Claude's round 3 IdleSnake themes from one shared template plus a palette each."""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
THEMES = HERE.parent
TEMPLATE = (HERE / "snake-template.css").read_text(encoding="utf-8")

BODY = ["#29391f", "#32204f", "#16465a", "#176052", "#843b2f", "#a55b25", "#702c57", "#252a32"]
HEAD = ["#182413", "#583b83", "#267b91", "#2d8b68", "#b3483d", "#b0802d", "#9b477e", "#596474"]

# Same hue, lifted for a dark LCD, so every colour choice still reads as itself.
LIFTED = {
    "#29391f": "#9ccc6e", "#32204f": "#b49cf0", "#16465a": "#62b6dc", "#176052": "#4fd6b4",
    "#843b2f": "#f0866f", "#a55b25": "#f2a35e", "#702c57": "#e57ab8", "#252a32": "#c4ccd8",
    "#583b83": "#c7aef8", "#267b91": "#7fd0ee", "#2d8b68": "#6fe0b4", "#b3483d": "#ff8d7a",
    "#b0802d": "#f5c46a", "#9b477e": "#f08fcb", "#596474": "#d8dee8",
}


def overlay_js(line_rgba, glow_inner, glow_outer):
    return f"""function overlay(ctx, canvas) {{
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
        glow.addColorStop(0, "{glow_inner}");
        glow.addColorStop(1, "{glow_outer}");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "{line_rgba}";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        ctx.restore();
      }}"""


def build(theme_id, name, note, font_family, font_url, palette, colors, overlay, extras):
    # theme.js
    js = f"""/* {name}: {note} */
ThemeKit.register({{
  id: "{theme_id}",
  name: "{name}",
  author: "Claude",
  fonts: "{font_url}",
  canvas: {{
    colors: {json.dumps(colors, indent=6)[:-1]}    }},
    fonts: {{ "Courier New": "{font_family}" }},
    scanlines: false,
    // Horizontal scanlines and a soft glow; no pixel grid.
    overlay: {overlay},
  }},
}});
"""
    (THEMES / theme_id / "theme.js").write_text(js, encoding="utf-8")

    # theme.css
    lines = [f'html[data-theme="{theme_id}"] {{']
    lines += [f"  --s-{k}: {v};" for k, v in palette.items()]
    lines.append("}")
    css = "\n".join(lines) + "\n\n" + TEMPLATE.replace("@ID@", theme_id) + "\n" + extras.strip().replace("@ID@", theme_id) + "\n"
    swatch_css = "\n/* Swatch previews show the colour the LCD draws */\n"
    for sw in BODY + HEAD:
        swatch_css += f'html[data-theme="{theme_id}"] .color-swatch[data-color="{sw}"] {{\n  background: {colors.get(sw, sw)};\n}}\n\n'
    css += swatch_css.rstrip() + "\n"
    header = f"/* {name} (Claude)\n   {note} */\n\n"
    (THEMES / theme_id / "theme.css").write_text(header + css, encoding="utf-8")
    print("wrote", theme_id)


# ---------- Clear Cover II (the improved favourite) ----------
build(
    "clear-cover-2", "Clear Cover II",
    "Round 2's favourite, improved: the translucent Bondi cover and its rounded pills stay;\n   the retail card is now dark, the LCD is a neutral grey-green with horizontal scanlines\n   instead of a blue tint and a pixel grid, every snake colour shows as chosen, and seeds\n   have a Bondi centre.",
    "Jost", "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap",
    {
        "font": '"Jost", "Futura", "Segoe UI", sans-serif',
        "page": "#0c1213", "menu": "#121a1c", "raise": "#1c2629", "raise-2": "#243134",
        "line": "#26343a", "line-strong": "#3a4d54", "grid": "rgba(255, 255, 255, 0.025)",
        "text": "#eef5f6", "muted": "#9fb2b7", "faint": "#61757a",
        "accent": "#18a6bb", "accent-ink": "#04262c", "accent-text": "#6fd6e4",
        "button": "#18a6bb", "button-ink": "#04262c", "button-hover": "#2fbacd",
        "radius-panel": "20px", "radius-box": "14px", "radius-pill": "999px", "radius-button": "999px",
        "c1": "#f2c45a", "c2": "#8fd99a", "c3": "#6fd6e4",
        "stop": "#e5634f", "stop-text": "#ff8f7c", "go": "#3fbf6a", "egg": "#d6eef2",
        "nursery-bg": "#e3b25f", "nursery-ink": "#3a2408", "nursery-frame": "#2a3538",
        "lcd": "#d2dbd2", "lcd-ink": "#1d2622", "lcd-dim": "#5e6c65",
        "lcd-glow": "inset 0 0 14px rgba(0, 0, 0, 0.16)", "seed": "#14a0b4",
        "lens": "rgba(8, 30, 36, 0.9)", "hint": "#cfe9ee", "brand": "#ffffff",
        "key-bg": "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(220, 238, 242, 0.84))",
        "key-border": "rgba(4, 60, 70, 0.55)", "key-highlight": "#ffffff", "key-base": "rgba(4, 60, 70, 0.55)",
        "key-ink": "#0b6f7e", "nav-bg": "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(220, 238, 242, 0.84))", "nav-ink": "#0b6f7e",
        "key-locked": "rgba(255, 255, 255, 0.26)", "key-locked-border": "rgba(4, 60, 70, 0.35)", "key-locked-ink": "rgba(255, 255, 255, 0.8)",
        "dpad-well": "rgba(8, 60, 70, 0.45)",
    },
    {
        "#9cac77": "#d2dbd2", "#182413": "#1d2622", "#e7e1c5": "#f4f7f2",
        "#132218": "#18201c", "#1b2b20": "#212b26", "#1c2c22": "#232e28",
        "#4b562f": "#66756c", "#708b59": "#9fae9f", "#344336": "#55625a",
    },
    overlay_js("rgba(0, 0, 0, 0.05)", "rgba(255, 255, 255, 0.12)", "rgba(0, 0, 0, 0.08)"),
    """
/* ---------- the translucent cover over the circuit board ---------- */

html[data-theme="@ID@"] .phone-shell {
  padding: 16px 18px 24px;
  border: 1px solid #075664;
  border-radius: 72px 72px 64px 64px / 56px 56px 72px 72px;
  background:
    radial-gradient(ellipse 50% 18% at 30% 5%, rgba(255, 255, 255, 0.3), transparent 70%),
    linear-gradient(90deg, rgba(4, 60, 70, 0.35), transparent 14% 86%, rgba(4, 60, 70, 0.35)),
    linear-gradient(rgba(0, 160, 192, 0.9), rgba(0, 124, 152, 0.92)),
    linear-gradient(#202326, #202326) 72% 74% / 44px 28px no-repeat,
    linear-gradient(#202326, #202326) 22% 86% / 30px 18px no-repeat,
    repeating-linear-gradient(90deg, transparent 0 26px, rgba(214, 178, 84, 0.5) 26px 28px),
    repeating-linear-gradient(0deg, transparent 0 38px, rgba(214, 178, 84, 0.4) 38px 40px),
    #1d6b4a;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.35),
    inset 0 -4px 10px rgba(4, 60, 70, 0.4),
    0 24px 40px -12px rgba(0, 0, 0, 0.6);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 44px;
  height: 6px;
  border-radius: 3px;
  background: rgba(4, 40, 46, 0.75);
  filter: none;
}

html[data-theme="@ID@"] .phone-brand {
  text-transform: lowercase;
}

html[data-theme="@ID@"] .menu-panel h1 {
  text-transform: lowercase;
}
""",
)

# ---------- Amber Graphite ----------
build(
    "amber-graphite", "Amber Graphite",
    "A brushed gunmetal phone with graphite keys and a softer amber backlight with scanlines.\n   The menu is near-black with a faint grid, Schibsted Grotesk, and sharp solid off-white\n   buttons. The nursery is a second, green LCD.",
    "Schibsted Grotesk", "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap",
    {
        "font": '"Schibsted Grotesk", "Helvetica Neue", Arial, sans-serif',
        "page": "#0b0b0c", "menu": "#121213", "raise": "#1d1d1f", "raise-2": "#262628",
        "line": "#2a2a2d", "line-strong": "#3e3e43", "grid": "rgba(255, 255, 255, 0.03)",
        "text": "#f1ede4", "muted": "#a8a49b", "faint": "#64615b",
        "accent": "#e0a24a", "accent-ink": "#1a1206", "accent-text": "#f0bb6c",
        "button": "#f1ede4", "button-ink": "#121213", "button-hover": "#ffffff",
        "radius-panel": "10px", "radius-box": "6px", "radius-pill": "999px", "radius-button": "6px",
        "c1": "#e0a24a", "c2": "#b9c9a0", "c3": "#9fc4e0",
        "stop": "#d9583f", "stop-text": "#f08a70", "go": "#6fbf5a", "egg": "#f6dfae",
        "nursery-bg": "#a9c48f", "nursery-ink": "#1d2a14", "nursery-frame": "#2a2a2d",
        "lcd": "#d9aa5e", "lcd-ink": "#2b1a05", "lcd-dim": "#7a5520",
        "lcd-glow": "inset 0 0 18px rgba(43, 26, 5, 0.25), 0 0 18px rgba(217, 170, 94, 0.12)", "seed": "#8a2414",
        "lens": "#0c0c0d", "hint": "#8f8b84", "brand": "#c9c5bc",
        "key-bg": "linear-gradient(180deg, #3b3d41, #26282b)",
        "key-border": "#0e0f10", "key-highlight": "rgba(255, 255, 255, 0.12)", "key-base": "#070708",
        "key-ink": "#ece8df", "nav-bg": "linear-gradient(180deg, #5d6066, #3b3d42)", "nav-ink": "#f1ede4",
        "key-locked": "#1c1d1f", "key-locked-border": "#111213", "key-locked-ink": "#57544f",
        "dpad-well": "#141516",
    },
    {
        "#9cac77": "#d9aa5e", "#182413": "#2b1a05", "#101713": "#1b1003", "#e7e1c5": "#f6dfae",
        "#132218": "#24160a", "#1b2b20": "#2e1d0b", "#1c2c22": "#311f0c",
        "#4b562f": "#8a5f22", "#708b59": "#b98a46", "#344336": "#6e4b1c",
    },
    overlay_js("rgba(43, 26, 5, 0.08)", "rgba(255, 236, 190, 0.16)", "rgba(43, 26, 5, 0.18)"),
    """
/* ---------- the brushed gunmetal phone ---------- */

html[data-theme="@ID@"] .phone-shell {
  width: min(94vw, 310px);
  padding: 20px 20px 24px;
  border: 1px solid #121315;
  border-radius: 44px 44px 40px 40px / 34px 34px 32px 32px;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, rgba(0, 0, 0, 0.05) 1px 2px),
    linear-gradient(90deg, #26282b 0%, #44474d 16%, #575a60 38%, #45484d 62%, #2f3135 84%, #222427 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -2px 4px rgba(0, 0, 0, 0.4),
    0 28px 44px -12px rgba(0, 0, 0, 0.7);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #0c0c0d;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.12);
  filter: none;
}
""",
)

# ---------- Night Green ----------
night = {
    "#9cac77": "#0f1c16", "#182413": "#a6f2c8", "#101713": "#08110d", "#e7e1c5": "#e8fff2",
    "#132218": "#0b140f", "#1b2b20": "#13241c", "#1c2c22": "#16281f",
    "#4b562f": "#5f9c7c", "#f2e9ba": "#fff1c2", "#e4c65e": "#f2c45a",
    "#fffdf0": "#ffffff", "#d5d5c8": "#c8d4ce", "#718253": "#7fd0a6", "#4b3d2a": "#9a8a70",
    "#708b59": "#1d3a2c", "#344336": "#0a120e", "#38502a": "#3f8f68", "#496536": "#58b080", "#5c7840": "#7fd0a6",
    "rgb(88, 110, 58)": "#7fd0a6", "#16231d": "#0f1c16", "#243b2a": "#14271e", "#29452f": "#173024", "#d5df9d": "#a6f2c8",
}
night.update({k: v for k, v in LIFTED.items()})
build(
    "night-green", "Night Green",
    "A dark metallic phone with a near-black green LCD and bright mint pixels. Snake colours\n   are lifted in their own hues so every choice shows. The menu is dark with a faint mint\n   grid, Hanken Grotesk, mint pill buttons, and open ruled colony rows. The nursery is amber.",
    "Hanken Grotesk", "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap",
    {
        "font": '"Hanken Grotesk", "Helvetica Neue", Arial, sans-serif',
        "page": "#080b0a", "menu": "#0e1311", "raise": "#18201c", "raise-2": "#1f2924",
        "line": "#222c27", "line-strong": "#35453d", "grid": "rgba(166, 242, 200, 0.035)",
        "text": "#e9f3ee", "muted": "#9db3a8", "faint": "#5b6d64",
        "accent": "#a6f2c8", "accent-ink": "#0b1a12", "accent-text": "#a6f2c8",
        "button": "#a6f2c8", "button-ink": "#0b1a12", "button-hover": "#c4f8db",
        "radius-panel": "16px", "radius-box": "10px", "radius-pill": "999px", "radius-button": "999px",
        "c1": "#f2c45a", "c2": "#a6f2c8", "c3": "#8ec5ff",
        "stop": "#e5634f", "stop-text": "#ff8f7c", "go": "#4fd17a", "egg": "#fff1c2",
        "nursery-bg": "#e0ab55", "nursery-ink": "#2e1c05", "nursery-frame": "#18201c",
        "lcd": "#0f1c16", "lcd-ink": "#a6f2c8", "lcd-dim": "#4f8a6c",
        "lcd-glow": "inset 0 0 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(166, 242, 200, 0.06)", "seed": "#f2b33d",
        "lens": "#070908", "hint": "#8fa79b", "brand": "#bfd8cb",
        "key-bg": "linear-gradient(180deg, #2e3432, #1d2120)",
        "key-border": "#0a0c0b", "key-highlight": "rgba(255, 255, 255, 0.1)", "key-base": "#040505",
        "key-ink": "#dfeee6", "nav-bg": "linear-gradient(180deg, #4a5450, #2f3634)", "nav-ink": "#e9f3ee",
        "key-locked": "#151918", "key-locked-border": "#0b0d0c", "key-locked-ink": "#4c5953",
        "dpad-well": "#0f1211",
    },
    night,
    overlay_js("rgba(0, 0, 0, 0.22)", "rgba(166, 242, 200, 0.06)", "rgba(0, 0, 0, 0.25)"),
    """
/* ---------- the dark metallic phone ---------- */

html[data-theme="@ID@"] .phone-shell {
  padding: 18px 18px 24px;
  border: 1px solid #050606;
  border-radius: 56px 56px 48px 48px / 44px 44px 40px 40px;
  background:
    radial-gradient(ellipse 60% 20% at 30% 4%, rgba(255, 255, 255, 0.1), transparent 70%),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 2px),
    linear-gradient(90deg, #121514 0%, #262b2a 18%, #313736 42%, #252a29 72%, #111413 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -4px 10px rgba(0, 0, 0, 0.5),
    0 28px 44px -12px rgba(0, 0, 0, 0.75);
}

html[data-theme="@ID@"] .speaker-slot {
  width: 44px;
  height: 5px;
  border-radius: 3px;
  background: #050606;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
  filter: none;
}
""",
)
