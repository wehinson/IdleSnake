// Shared shipped puzzle content. Level order is part of saved progress.
(function attachPuzzleLevels(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakePuzzleLevels = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
const sokobanLevels = [
  {
    name: "First Push",
    reward: 20,
    map: [
      "###############",
      "#.............#",
      "#.............#",
      "#.............#",
      "#....###......#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#......###....#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############"
    ],
    snake: [{ x: 3, y: 11 }, { x: 2, y: 11 }, { x: 1, y: 11 }],
    crates: [{ x: 7, y: 7, kind: "light" }],
    goals: [{ x: 11, y: 7 }],
    pellets: [{ x: 5, y: 11 }],
    plates: [],
    gates: []
  },
  {
    name: "Hold the Gate",
    reward: 35,
    map: [
      "###############",
      "#.............#",
      "#..#########..#",
      "#.............#",
      "#..#########..#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#..#####......#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############"
    ],
    snake: [{ x: 3, y: 11 }, { x: 2, y: 11 }, { x: 1, y: 11 }],
    crates: [{ x: 4, y: 5, kind: "light" }, { x: 10, y: 9, kind: "light" }],
    goals: [{ x: 11, y: 5 }, { x: 11, y: 9 }],
    pellets: [{ x: 5, y: 11 }],
    plates: [{ x: 3, y: 3, id: "gate-a" }],
    gates: [{ x: 7, y: 3, id: "gate-a" }]
  },
  {
    name: "Anchor Point",
    reward: 45,
    map: [
      "###############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.............#",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############"
    ],
    snake: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }],
    crates: [{ x: 6, y: 7, kind: "heavy" }],
    goals: [{ x: 7, y: 7 }],
    pellets: [{ x: 1, y: 4 }, { x: 1, y: 6 }],
    plates: [],
    gates: []
  },
  {
    name: "Brace Point",
    reward: 60,
    map: [
      "###############",
      "#.............#",
      "#..#####......#",
      "#.............#",
      "#......#####..#",
      "#.............#",
      "#.............#",
      "#..#####......#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############"
    ],
    snake: [{ x: 5, y: 11 }, { x: 4, y: 11 }, { x: 3, y: 11 }],
    crates: [{ x: 8, y: 11, kind: "heavy" }, { x: 8, y: 6, kind: "light" }],
    goals: [{ x: 11, y: 11 }, { x: 11, y: 6 }],
    pellets: [{ x: 6, y: 10 }, { x: 5, y: 9 }],
    plates: [{ x: 3, y: 5, id: "gate-b" }],
    gates: [{ x: 7, y: 5, id: "gate-b" }]
  },
  {
    name: "Twin Anchors",
    reward: 85,
    map: [
      "###############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.#############",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############",
      "###############",
      "###############",
      "###############",
      "###############"
    ],
    snake: [{ x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }],
    crates: [{ x: 6, y: 7, kind: "heavy" }, { x: 8, y: 9, kind: "heavy" }],
    goals: [{ x: 7, y: 7 }, { x: 7, y: 9 }],
    pellets: [{ x: 1, y: 4 }, { x: 1, y: 6 }],
    plates: [],
    gates: []
  }
];
const snakebirdLevels = [
  {
    name: "First Perch",
    firstClearReward: 20,
    replayReward: 5,
    map: [
      ".........",
      ".........",
      "...F.....",
      ".........",
      "..###....",
      "..Hoo.F.G",
      "#########"
    ]
  },
  {
    name: "Long Reach",
    firstClearReward: 30,
    replayReward: 7,
    map: [
      "..........",
      "..........",
      "..........",
      "...###....",
      "..........",
      "..F.F.F.FG.",
      "...Hoo....",
      "##########"
    ]
  },
  {
    name: "Split Branch",
    firstClearReward: 45,
    replayReward: 10,
    map: [
      "...........",
      "...........",
      "..###......",
      "...........",
      "...........",
      "..F.F.F.FG.",
      "...Hoo.....",
      "###########"
    ]
  },
  {
    name: "Weight Shift",
    firstClearReward: 65,
    replayReward: 15,
    map: [
      "............",
      "............",
      "....###.....",
      "............",
      "..####......",
      "............",
      "............",
      "...HooFFFF.G",
      "############"
    ]
  },
  {
    name: "Nest Run",
    firstClearReward: 100,
    replayReward: 25,
    map: [
      ".............",
      ".............",
      "....###......",
      ".............",
      ".............",
      "..#####......",
      ".............",
      ".............",
      "...HooFFFFF.G",
      "#############"
    ]
  }
];

  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  return freeze({ snakebird: snakebirdLevels, sokoban: sokobanLevels });
});
