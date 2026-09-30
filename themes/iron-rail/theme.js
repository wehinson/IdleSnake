// Iron Rail: a 1930s art-deco railway. The snake is a train drawn on an engineer's blueprint.
(function () {
  const chalk = "#eaf2ff";
  const colors = {
    // Blueprint paper and white drafting ink
    "#9cac77": "#1f4e8c",
    "#182413": chalk,
    "#101713": "#0d2140",
    "#e7e1c5": "#fdf6e3",
    "rgb(231, 225, 197)": "#fdf6e3",
    "#132218": "#0d2140",
    "#1b2b20": "#143566",
    "#1c2c22": "#163a6a",
    // Carriages (body swatches) and locomotives (head swatches)
    "#29391f": "#e0b04a",
    "#32204f": "#b8a0f0",
    "#16465a": "#7fc8f0",
    "#176052": "#6fd8b8",
    "#843b2f": "#e8604a",
    "#a55b25": "#f0913a",
    "#702c57": "#e07ab8",
    "#252a32": "#c9d3de",
    "#583b83": "#d4c4ff",
    "#267b91": "#bfe6ff",
    "#2d8b68": "#a8f0d4",
    "#b3483d": "#ff9a84",
    "#b0802d": "#f5d27a",
    "#9b477e": "#f5b8dc",
    "#596474": "#dfe6ee",
    // Cargo, cinders, boilers, and buffers
    "#4b562f": "#9fb8d8",
    "#f2e9ba": "#fdf6e3",
    "#e4c65e": "#f5d27a",
    "rgb(82, 190, 255)": "#ffc94a",
    "rgb(74, 175, 255)": "#ffd978",
    // Excursions
    "#fffdf0": "#ffffff",
    "#d5d5c8": "#c9d3de",
    "#718253": "#8fb0d8",
    "#4b3d2a": "#0d2140",
    "#708b59": "#2b5f9e",
    "#344336": "#163a6a",
    "#38502a": "#4aa3d8",
    "#496536": "#7fc0e8",
    "#5c7840": "#b0dcf5",
    "rgb(88, 110, 58)": "#f5d27a",
    "#16231d": "#123260",
    "#243b2a": "#1a3f73",
    "#29452f": "#1d4680",
    "#d5df9d": chalk,
    "#8fa6d6": "#b0c8f0",
    "#f6e8a4": "#fdf6e3",
    "#efe7b4": "#fdf0d0",
  };

  const reduced = () =>
    document.documentElement.dataset.reducedMotion === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches;

  ThemeKit.register({
    id: "iron-rail",
    name: "Iron Rail",
    author: "Claude",
    title: "Iron Rail Express",
    fonts: "https://fonts.googleapis.com/css2?family=Limelight&family=Josefin+Sans:wght@400;600;700&display=swap",
    canvas: {
      colors,
      fonts: { "Courier New": "Josefin Sans" },
      scanlines: false,
      // Fine drafting grid, a title block corner, and drifting steam.
      overlay(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        ctx.strokeStyle = "rgba(234, 242, 255, 0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0.5; x < w; x += 12) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = 0.5; y < h; y += 12) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();
        ctx.strokeStyle = "rgba(234, 242, 255, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        if (!reduced()) {
          const t = performance.now() / 1000;
          for (let i = 0; i < 4; i += 1) {
            const phase = (t * 0.07 + i / 4) % 1;
            ctx.fillStyle = `rgba(234, 242, 255, ${0.07 * (1 - phase)})`;
            ctx.beginPath();
            ctx.arc(w * (0.15 + i * 0.22), h * (1 - phase), 18 + phase * 40, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      },
    },
    phrases: {
      // Title and brand
      "Snake Forever": "Iron Rail Express",
      "SNAKE FOREVER": "IRON RAIL EXPRESS",
      "PHONE": "LINE",
      "Menu": "Timetable",
      "Phone Mode": "Cab Mode",

      // Currencies and resources
      "Seeds": "Coal",
      "Seed": "Coal",
      "seeds": "coal",
      "seed": "coal",
      "Branches": "Timber",
      "branches": "timber",
      "Provisions": "Freight",
      "provisions": "freight",
      "Pod": "Coal Sack",
      "Fruit": "Mail Bag",
      "snacks": "pickups",
      "snack": "pickup",
      "Shields": "Buffers",
      "shields": "buffers",
      "Shield": "Buffer",
      "shield": "buffer",
      "collision saves": "buffer saves",

      // Menu areas
      "Upgrades": "Engineering",
      "Nursery": "Engine Works",
      "Colony": "Rail Yards",
      "Settle": "Frontier",
      "Board size": "Yard size",
      "Food type": "Cargo type",
      "Food count": "Cargo count",
      "Minigames": "Excursions",
      "Add Nest Slot": "Add Assembly Bay",
      "Nest": "Assembly Bay",
      "Eggs": "Boilers",
      "Egg": "Boiler",
      "eggs": "boilers",
      "egg": "boiler",
      "Hatchling yard": "Shunting Yard",
      "Hatchlings": "Tank Engines",
      "Hatchling": "Tank Engine",
      "hatchlings": "tank engines",
      "hatchling": "tank engine",
      "Upgrade Nursery": "Expand Works",
      "Habitats": "Lines",
      "Notables": "Famous Engines",
      "Notable": "Famous Engine",
      "Elders": "Museum Pieces",
      "Adults": "Mainline Engines",
      "Convoy": "Consist",
      "Settlements": "Termini",
      "Settlement": "Terminus",
      "Grasslands": "Central Station",
      "Wetlands": "Marsh Junction",
      "Highlands": "Summit Pass",
      "Badlands": "Dust Flats",
      "Coast": "Harbor Line",
      "expeditions": "survey runs",
      "expedition": "survey run",
      "Field": "Farm Line",
      "Lake": "Lakeside",
      "Forest": "Timber Line",
      "River": "River Bridge",
      "Cave": "Tunnel",
      "Ocean": "Ferry Dock",
      "Mountain": "Mountain Pass",
      "Blizzard": "Snowshed",

      // Trains
      "Snakes": "Trains",
      "Snake": "Train",
      "snakes": "trains",
      "snake": "train",

      // Excursions (minigames) and their pieces
      "Vs Snake": "Rival Line",
      "Snake Runner": "Express Run",
      "Snakeger": "Level Crossing",
      "Brick Breakout": "Signal Breakout",
      "Centipede": "Freight Swarm",
      "Broodline": "Rolling Stock",
      "BROODLINE": "ROLLING STOCK",
      "Venom Strike": "Rail Gun",
      "venom": "shell",
      "Snakebird": "Skyline Rail",
      "Sokoban": "Freight Shunter",
      "Maze": "Junction Maze",
      "Crossing": "Level Crossing",
      "Titanoboa": "Big Boy",
      "Anaconda": "Mallard",
      "Python": "Flying Scot",
      "Viper": "Rocket",
      "Adder": "Pug",

      // Screen and controls
      "Personalization": "Livery",
      "Personalize": "Livery",
      "PERSONALIZE": "LIVERY",
      "Score": "Miles",
      "Best": "Record",
      "Game Over": "Derailed",
      "Paused": "Held at Signal",
      "Moss": "Brass",
      "Dark purple": "Lilac",
      "Teal": "Sea Green",
      "Ember": "Signal Red",
      "Orange": "Copper",
      "Berry": "Rose",
      "Charcoal": "Steel",
      "Violet": "Lavender",
      "Sky": "Pale Blue",
      "Mint": "Mint",
      "Ruby": "Coral",
      "Gold": "Gold Leaf",
      "Plum": "Blush",
      "Slate": "Nickel",
    },
  });
})();
