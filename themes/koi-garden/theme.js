// Koi Garden: an ink-wash scroll of a koi pond, a lacquered box, and river-stone keys.
(function () {
  const ink = "#1e2a30";
  const paper = "#eadfc4";
  const colors = {
    // Screen, ink, and light
    "#9cac77": paper,
    "#182413": ink,
    "#101713": "#141c20",
    "#e7e1c5": "#fff8ea",
    "rgb(231, 225, 197)": "#fff8ea",
    "#132218": "#1a252b",
    "#1b2b20": "#223038",
    "#1c2c22": "#24323a",
    // Koi bodies (body swatches) and heads (head swatches)
    "#29391f": "#d9582b",
    "#32204f": "#4f7ea8",
    "#16465a": "#2f6d8f",
    "#176052": "#3f8f8a",
    "#843b2f": "#b3263a",
    "#a55b25": "#e0922f",
    "#702c57": "#8a4a7a",
    "#252a32": "#2b2f36",
    "#583b83": "#6b4a8f",
    "#267b91": "#3a78a0",
    "#2d8b68": "#2f7f63",
    "#b3483d": "#c0392b",
    "#b0802d": "#c69a3a",
    "#9b477e": "#9b3f6e",
    "#596474": "#5d6670",
    // Food, crumbs, eggs, and shields
    "#4b562f": "#8a7458",
    "#f2e9ba": "#fff4dc",
    "#e4c65e": "#d8a531",
    "rgb(82, 190, 255)": "#4aa3c9",
    "rgb(74, 175, 255)": "#5fb6d6",
    // Minigames
    "#fffdf0": "#fbf7ee",
    "#d5d5c8": "#d9d2c3",
    "#718253": "#8a7a5a",
    "#4b3d2a": "#3a2c24",
    "#708b59": "#8e9c6e",
    "#344336": "#3b4a52",
    "#38502a": "#2f4f5a",
    "#496536": "#3f6f6a",
    "#5c7840": "#5f8f7a",
    "rgb(88, 110, 58)": "#d6789a",
    "#16231d": "#1c2b30",
    "#243b2a": "#26393f",
    "#29452f": "#2b4249",
    "#d5df9d": "#e9d8a6",
    "#f6e8a4": "#fff1cf",
    "#efe7b4": "#fbeccb",
    "#e5a04c": "#e0922f",
    "#e0c15a": "#d8a531",
    "#f4d39a": "#f2d49a",
    "#d0574e": "#c0392b",
    "#7bc86c": "#5fae8a",
    "#d58964": "#d8825a",
    "#c4574e": "#b3263a",
  };

  const reduced = () =>
    document.documentElement.dataset.reducedMotion === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches;

  ThemeKit.register({
    id: "koi-garden",
    name: "Koi Garden",
    author: "Claude",
    title: "Endless Pond",
    fonts: "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;800&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap",
    canvas: {
      colors,
      fonts: { "Courier New": "Zen Kaku Gothic New" },
      scanlines: false,
      // Washi paper fibres, a slow ripple, and a warm scroll vignette.
      overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
        vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
        vignette.addColorStop(1, "rgba(120, 80, 30, 0.22)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
        const t = reduced() ? 0 : performance.now() / 1000;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i += 1) {
          const phase = (t * 0.18 + i / 3) % 1;
          ctx.strokeStyle = `rgba(30, 60, 70, ${0.12 * (1 - phase)})`;
          ctx.beginPath();
          ctx.arc(w * 0.72, h * 0.28, 12 + phase * w * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },
    },
    phrases: {
      // Title and brand
      "Snake Forever": "Endless Pond",
      "SNAKE FOREVER": "ENDLESS POND",
      "PHONE": "SCROLL",
      "Menu": "Garden Scroll",
      "Phone Mode": "Scroll Mode",

      // Currencies and resources
      "Seeds": "Petals",
      "Seed": "Petal",
      "seeds": "petals",
      "seed": "petal",
      "Branches": "Bamboo",
      "branches": "bamboo",
      "Provisions": "Rice",
      "provisions": "rice",
      "Pod": "Lotus Pod",
      "Fruit": "Plum",
      "snacks": "morsels",
      "snack": "morsel",
      "Shields": "Charms",
      "shields": "charms",
      "Shield": "Charm",
      "shield": "charm",
      "collision saves": "charm saves",

      // Menu areas
      "Upgrades": "Cultivation",
      "Nursery": "Spawning Pool",
      "Colony": "Water Garden",
      "Settle": "Voyage",
      "Board size": "Pond size",
      "Food type": "Offering",
      "Food count": "Offerings",
      "Minigames": "Pastimes",
      "Add Nest Slot": "Add Lily Pad",
      "Nest": "Lily Pad",
      "Eggs": "Roe",
      "Egg": "Roe",
      "eggs": "roe",
      "egg": "roe",
      "Hatchling yard": "Fry Pool",
      "Hatchlings": "Fry",
      "Hatchling": "Fry",
      "hatchlings": "fry",
      "hatchling": "fry",
      "Upgrade Nursery": "Deepen Pool",
      "Habitats": "Ponds",
      "Notables": "Honored Koi",
      "Notable": "Honored Koi",
      "Elders": "Ancients",
      "Adults": "Grown Koi",
      "Convoy": "Procession",
      "Settlements": "Shrine Ponds",
      "Settlement": "Shrine Pond",
      "Grasslands": "Home Pond",
      "Wetlands": "Reed Marsh",
      "Highlands": "Mountain Spring",
      "Badlands": "Stone Garden",
      "Coast": "Tidal Inlet",
      "expeditions": "pilgrimages",
      "expedition": "pilgrimage",
      "Field": "Rice Paddy",
      "Forest": "Bamboo Grove",
      "Cave": "Grotto",
      "Ocean": "Sea",
      "Mountain": "Waterfall",
      "Blizzard": "Snow Garden",

      // Koi
      "Snakes": "Koi",
      "Snake": "Koi",
      "snakes": "koi",
      "snake": "koi",

      // Pastimes (minigames) and their pieces
      "Vs Snake": "Koi Duel",
      "Snake Runner": "River Run",
      "Snakeger": "Stepping Stones",
      "Brick Breakout": "Lantern Breakout",
      "Centipede": "Dragonfly Swarm",
      "Broodline": "Koi Lineage",
      "BROODLINE": "KOI LINEAGE",
      "Venom Strike": "Ink Strike",
      "venom": "ink",
      "Snakebird": "Koi Leap",
      "Sokoban": "Stone Push",
      "Maze": "Garden Maze",
      "Crossing": "Stepping Stones",
      "Titanoboa": "Great Carp",
      "Anaconda": "Golden Carp",
      "Python": "Ghost Koi",
      "Viper": "Butterfly Koi",
      "Adder": "Minnow",

      // Screen and controls
      "Personalization": "Adornment",
      "Personalize": "Adorn",
      "PERSONALIZE": "ADORN",
      "Score": "Grace",
      "Game Over": "The Pond Stills",
      "Paused": "Resting",
      "Moss": "Kohaku",
      "Dark purple": "Asagi",
      "Teal": "Shusui",
      "Ember": "Beni",
      "Orange": "Yamabuki",
      "Berry": "Murasaki",
      "Charcoal": "Karasu",
      "Violet": "Fuji",
      "Sky": "Sora",
      "Mint": "Midori",
      "Ruby": "Hi",
      "Gold": "Ogon",
      "Plum": "Ume",
      "Slate": "Sumi",
    },
  });
})();
