// Silver Slim: the premium compact phone of 1999-2001 with an amber-backlit LCD.
(function () {
  const L = "#f2bb55"; // amber backlight
  const P = "#e3a744"; // pale tone
  const M = "#b07a26"; // mid tone
  const D = "#3b2608"; // pixel ink
  const X = "#241603"; // darkest ink

  ThemeKit.register({
    id: "silver-slim",
    name: "Silver Slim",
    author: "Claude",
    fonts: "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Silkscreen&display=swap",
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
        "#29391f": D,
        "#32204f": "#4a300c",
        "#16465a": "#5c3d10",
        "#176052": "#6e4a15",
        "#843b2f": "#2f1e05",
        "#a55b25": "#805719",
        "#702c57": "#432b0a",
        "#252a32": X,
        "#583b83": "#4a300c",
        "#267b91": "#5c3d10",
        "#2d8b68": "#6e4a15",
        "#b3483d": "#2f1e05",
        "#b0802d": "#805719",
        "#9b477e": "#432b0a",
        "#596474": "#8c621f",
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
        "#496536": "#805719",
        "#5c7840": M,
        "rgb(88, 110, 58)": M,
        "#16231d": L,
        "#243b2a": "#eab14d",
        "#29452f": "#e5ab48",
        "#d5df9d": D,
        "#67c993": D,
        "#8fa6d6": "#6e4a15",
        "#d9d45a": M,
        "#e37a47": X,
        "#b996cf": "#8c621f",
        "#91b957": "#805719",
        "#d58964": X,
        "#c4574e": X,
        "#e5a04c": M,
        "#e0c15a": M,
        "#f4d39a": P,
        "#d0574e": D,
        "#7bc86c": M,
      },
      fonts: { "Courier New": "Silkscreen" },
      scanlines: false,
      // Square pixel matrix plus a falloff at the edges, where the backlight is weaker.
      overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        ctx.fillStyle = "rgba(59, 38, 8, 0.05)";
        for (let x = 3; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
        for (let y = 3; y < h; y += 4) ctx.fillRect(0, y, w, 1);
        const falloff = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
        falloff.addColorStop(0, "rgba(59, 38, 8, 0)");
        falloff.addColorStop(1, "rgba(59, 38, 8, 0.16)");
        ctx.fillStyle = falloff;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      },
    },
  });
})();
