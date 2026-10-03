/* Night Green: A dark metallic phone with a near-black green LCD and bright mint pixels. Snake colours
   are lifted in their own hues so every choice shows. The menu is dark with a faint mint
   grid, Hanken Grotesk, mint pill buttons, and open ruled colony rows. The nursery is amber. */
ThemeKit.register({
  id: "night-green",
  name: "Night Green",
  author: "Claude",
  fonts: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap",
  canvas: {
    colors: {
      "#9cac77": "#0f1c16",
      "#182413": "#a6f2c8",
      "#101713": "#08110d",
      "#e7e1c5": "#e8fff2",
      "#132218": "#0b140f",
      "#1b2b20": "#13241c",
      "#1c2c22": "#16281f",
      "#4b562f": "#5f9c7c",
      "#f2e9ba": "#fff1c2",
      "#e4c65e": "#f2c45a",
      "#fffdf0": "#ffffff",
      "#d5d5c8": "#c8d4ce",
      "#718253": "#7fd0a6",
      "#4b3d2a": "#9a8a70",
      "#708b59": "#1d3a2c",
      "#344336": "#0a120e",
      "#38502a": "#3f8f68",
      "#496536": "#58b080",
      "#5c7840": "#7fd0a6",
      "rgb(88, 110, 58)": "#7fd0a6",
      "#16231d": "#0f1c16",
      "#243b2a": "#14271e",
      "#29452f": "#173024",
      "#d5df9d": "#a6f2c8",
      "#29391f": "#9ccc6e",
      "#32204f": "#b49cf0",
      "#16465a": "#62b6dc",
      "#176052": "#4fd6b4",
      "#843b2f": "#f0866f",
      "#a55b25": "#f2a35e",
      "#702c57": "#e57ab8",
      "#252a32": "#c4ccd8",
      "#583b83": "#c7aef8",
      "#267b91": "#7fd0ee",
      "#2d8b68": "#6fe0b4",
      "#b3483d": "#ff8d7a",
      "#b0802d": "#f5c46a",
      "#9b477e": "#f08fcb",
      "#596474": "#d8dee8"
    },
    fonts: { "Courier New": "Hanken Grotesk" },
    scanlines: false,
    // Horizontal scanlines and a soft glow; no pixel grid.
    overlay: function overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
        glow.addColorStop(0, "rgba(166, 242, 200, 0.06)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0.25)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        ctx.restore();
      },
  },
});
