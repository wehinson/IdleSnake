// Clear Cover: a 1999 translucent swap cover over the circuit board, with an ice-blue LCD.
(function () {
  const L = "#bfe3ea"; // ice-blue backlight
  const P = "#a3d0da"; // pale tone
  const M = "#6e9faa"; // mid tone
  const D = "#1d3640"; // pixel ink
  const X = "#11232b"; // darkest ink

  ThemeKit.register({
    id: "clear-cover",
    name: "Clear Cover",
    author: "Claude",
    fonts: "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=VT323&display=swap",
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
        "#32204f": "#2a4652",
        "#16465a": "#365a66",
        "#176052": "#436c78",
        "#843b2f": "#16303a",
        "#a55b25": "#527d89",
        "#702c57": "#233f4a",
        "#252a32": X,
        "#583b83": "#2a4652",
        "#267b91": "#365a66",
        "#2d8b68": "#436c78",
        "#b3483d": "#16303a",
        "#b0802d": "#527d89",
        "#9b477e": "#233f4a",
        "#596474": "#5f8c98",
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
        "#496536": "#527d89",
        "#5c7840": M,
        "rgb(88, 110, 58)": M,
        "#16231d": L,
        "#243b2a": "#b5dbe3",
        "#29452f": "#acd4dd",
        "#d5df9d": D,
        "#67c993": D,
        "#8fa6d6": "#436c78",
        "#d9d45a": M,
        "#e37a47": X,
        "#b996cf": "#5f8c98",
        "#91b957": "#527d89",
        "#d58964": X,
        "#c4574e": X,
        "#e5a04c": M,
        "#e0c15a": M,
        "#f4d39a": P,
        "#d0574e": D,
        "#7bc86c": M,
      },
      fonts: { "Courier New": "VT323" },
      scanlines: false,
      // Pixel matrix and a diagonal reflection on the clear window above the LCD.
      overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        ctx.fillStyle = "rgba(29, 54, 64, 0.05)";
        for (let x = 3; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
        for (let y = 3; y < h; y += 4) ctx.fillRect(0, y, w, 1);
        const glare = ctx.createLinearGradient(0, 0, w, h);
        glare.addColorStop(0, "rgba(255, 255, 255, 0.16)");
        glare.addColorStop(0.32, "rgba(255, 255, 255, 0.04)");
        glare.addColorStop(0.33, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glare;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      },
    },
  });
})();
