// Navy Brick: the classic 2000 navy candybar with a green-backlit monochrome LCD.
// Every canvas colour collapses onto four LCD tones, as on the real 84x48 panel.
(function () {
  const L = "#c7f0d8"; // backlit field
  const P = "#a9cdb6"; // pale tone (light accents)
  const M = "#7f9c86"; // mid tone (secondary pieces)
  const D = "#43523d"; // pixel ink
  const X = "#2b3527"; // darkest ink

  ThemeKit.register({
    id: "navy-brick",
    name: "Navy Brick",
    author: "Claude",
    fonts: "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Archivo:wght@500;600;700&display=swap",
    canvas: {
      colors: {
        "#9cac77": L,
        "#182413": D,
        "#101713": X,
        "#e7e1c5": L,
        "#132218": X,
        "#1b2b20": X,
        "#1c2c22": X,
        "#f6e8a4": L,
        "#efe7b4": L,
        // Snake bodies and heads: monochrome shades so every choice still differs
        "#29391f": D,
        "#32204f": "#3a4735",
        "#16465a": "#4f6049",
        "#176052": "#5c6f57",
        "#843b2f": "#34402f",
        "#a55b25": "#55654e",
        "#702c57": "#3f4c39",
        "#252a32": X,
        "#583b83": "#3a4735",
        "#267b91": "#4f6049",
        "#2d8b68": "#5c6f57",
        "#b3483d": "#34402f",
        "#b0802d": "#55654e",
        "#9b477e": "#3f4c39",
        "#596474": "#6b7d60",
        // Pickups, effects, and minigame pieces
        "#4b562f": M,
        "#f2e9ba": P,
        "#e4c65e": M,
        "rgb(82, 190, 255)": M,
        "rgb(74, 175, 255)": M,
        "#fffdf0": M,
        "#d5d5c8": P,
        "#718253": M,
        "#4b3d2a": X,
        "#708b59": M,
        "#344336": P,
        "#38502a": D,
        "#496536": "#55654e",
        "#5c7840": M,
        "rgb(88, 110, 58)": M,
        "#16231d": L,
        "#243b2a": "#bde4cc",
        "#29452f": "#b5dbc3",
        "#d5df9d": D,
        "#67c993": D,
        "#8fa6d6": "#5c6f57",
        "#d9d45a": M,
        "#e37a47": X,
        "#b996cf": "#6b7d60",
        "#91b957": "#55654e",
        "#d58964": X,
        "#c4574e": X,
        "#e5a04c": M,
        "#e0c15a": M,
        "#f4d39a": P,
        "#d0574e": D,
        "#7bc86c": M,
      },
      fonts: { "Courier New": "Pixelify Sans" },
      scanlines: false,
      // A faint static pixel matrix and the soft inner shadow of a recessed LCD.
      overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        ctx.fillStyle = "rgba(67, 82, 61, 0.05)";
        for (let x = 3; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
        for (let y = 3; y < h; y += 4) ctx.fillRect(0, y, w, 1);
        const shade = ctx.createLinearGradient(0, 0, 0, 18);
        shade.addColorStop(0, "rgba(43, 53, 39, 0.18)");
        shade.addColorStop(1, "rgba(43, 53, 39, 0)");
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, w, 18);
        ctx.restore();
      },
    },
  });
})();
