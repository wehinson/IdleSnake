// Shared shipped puzzle content. Level order is part of saved progress.
(function attachPuzzleLevels(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakePuzzleLevels = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
const sokobanLevels = (() => {
  // Authoring legend: H/1/2 = head/body/tail, p = growth, C/c = heavy/light
  // crate, G = goal, a/b = plates, A/B = matching gates. Each compact room
  // is centered in the existing 15x15 board; all other cells are walls.
  function stage(name, reward, lesson, room) {
    const offsetX = Math.floor((15 - room[0].length) / 2);
    const offsetY = Math.floor((15 - room.length) / 2);
    const map = Array.from({ length: 15 }, () => Array(15).fill("#"));
    const definition = { name, reward, lesson, map: [], snake: [], crates: [], goals: [], pellets: [], plates: [], gates: [] };
    room.forEach((row, y) => [...row].forEach((cell, x) => {
      const point = { x: x + offsetX, y: y + offsetY };
      map[point.y][point.x] = cell === "#" ? "#" : ".";
      if ("H12".includes(cell)) definition.snake[cell === "H" ? 0 : Number(cell)] = point;
      if (cell === "C" || cell === "c") definition.crates.push({ ...point, kind: cell === "C" ? "heavy" : "light" });
      if (cell === "G") definition.goals.push(point);
      if (cell === "p") definition.pellets.push(point);
      if (cell === "a" || cell === "b") definition.plates.push({ ...point, id: cell });
      if (cell === "A" || cell === "B") definition.gates.push({ ...point, id: cell.toLowerCase() });
    }));
    definition.map = map.map(row => row.join(""));
    return definition;
  }
  return [
    stage("Measure the Gap", 20, "The spaces include the head. A bent body works; spare pellets are optional.", [
      "########", "#21pp..#", "##Hpc.G#", "########"
    ]),
    stage("Close Backstop", 35, "An interior wall permits three short-body shoves through a much larger room.", [
      "##########", "#21H....p#", "#........#", "#.#.c..G.#", "#p.......#", "##########"
    ]),
    stage("Last Shove", 45, "Each shove increases the gap. Feed once more or the last shove will fail.", [
      "#########", "#21Hpc.G#", "#p...p###", "#########"
    ]),
    stage("Corner Crane", 60, "A wall blocks the direct lift. Shift sideways, then use the floor wall to lift.", [
      "#########", "#21H..G.#", "#.......#", "#..#.c..#", "#p...#p.#", "#########"
    ]),
    stage("Feed or Relocate", 85, "Grow for the long delivery line, or move the box to a closer wall before turning.", [
      "###########", "#21Hppp...#", "#..#......#", "#.....c.G.#", "#.........#", "###########"
    ]),
    stage("Opposed Bays", 100, "A second box interrupts the wall line. Lift the obstruction before opposite deliveries.", [
      "#########", "#21H.p..#", "#..#....#", "#Gc...cG#", "#....#..#", "#p......#", "#########"
    ]),
    stage("Body Key", 120, "One extra segment can both span the gate plate and finish the growing wall gap.", [
      "#########", "#21Hp.p.#", "#.....###", "##a..cAG#", "#p....###", "#########"
    ]),
    stage("Narrow Relay", 145, "Park the first box off the line. The distant delivery then needs a six-cell reach.", [
      "###########", "#21Hppp...#", "#...#...###", "#...c..cG##", "#...#...###", "#p...G....#", "###########"
    ]),
    stage("Two Backstops", 170, "The top gate has a closer wall. The lower gate needs another segment; escape before feeding.", [
      "##########", "#21Hpp.p.#", "#......###", "##a..cAG##", "#......###", "#b...cBG##", "##########"
    ]),
    stage("Opposite Ends", 200, "Use right and left backing walls in different narrow lanes without trapping the body.", [
      "##########", "#21Hppp..#", "#...#....#", "#Gc....###", "#...#....#", "###....cG#", "#p.......#", "##########"
    ]),
    stage("Exchange Bays", 235, "Clear the short upward load first, then plan the two longer opposing delivery lines.", [
      "#########", "#..G....#", "#..c....#", "#21H.pp.#", "#Gc..cG.#", "#..#...p#", "#########"
    ]),
    stage("Plate Cross", 275, "One box blocks the other's backing line. Finish the vertical gate before the horizontal one.", [
      "#########", "###G#####", "#..B..###", "#a...cAG#", "#..c.b###", "#21Hppp.#", "#########"
    ]),
    stage("Switch the Anchor", 320, "The gate behind your head must stay open to reach the real wall beyond it.", [
      "##########", "#21Hpp...#", "#...a...##", "##.A..c.G#", "#p......##", "##########"
    ]),
    stage("Three Cargo Routes", 370, "Choose three growth pellets, keep the side plate covered, and deliver three loads in different directions.", [
      "###########", "#...G.....#", "#p..c..####", "#..#...cAG#", "#..a...####", "#Gc....####", "#21Hppp...#", "###########"
    ]),
    stage("Wall Ledger", 430, "Move the lower load aside instead of parking it. Its goal blocks the only route to the upper key.", [
      "###########", "####G######", "#...B..####", "##.#c..cAG#", "#b#a...####", "#Gc....####", "#21Hpppp..#", "###########"
    ])
  ];
})();
const snakebirdLevels = [
  {
    name: "Anchored Reach",
    optimalMoves: 7,
    firstClearReward: 20,
    replayReward: 5,
    map: [
      ".........",
      ".........",
      "..F......",
      ".........",
      "..Hoo..G.",
      ".####.###",
      ".........",
      "........."
    ]
  },
  {
    name: "Raised Landing",
    optimalMoves: 8,
    firstClearReward: 30,
    replayReward: 7,
    map: [
      ".........",
      ".........",
      "..F...G..",
      ".........",
      "..Hoo.#..",
      ".####.#..",
      "......#..",
      "........."
    ]
  },
  {
    name: "Drop to Feed",
    optimalMoves: 9,
    firstClearReward: 45,
    replayReward: 10,
    map: [
      ".........",
      ".........",
      ".Hoo.....",
      ".###.....",
      "......G..",
      ".....F#..",
      "....###..",
      "........."
    ]
  },
  {
    name: "Two Fruit Bridge",
    optimalMoves: 12,
    firstClearReward: 65,
    replayReward: 15,
    map: [
      "............",
      "............",
      "..F.........",
      "......F...G.",
      "..Hoo.......",
      ".####....###",
      "............",
      "............"
    ]
  },
  {
    name: "Fold and Climb",
    optimalMoves: 13,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      ".........",
      ".........",
      ".Hoo..G..",
      ".###..#..",
      "......#..",
      "....F.#..",
      "....###..",
      "........."
    ]
  },
  {
    name: "Lower Landing",
    optimalMoves: 14,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "..........",
      "..........",
      "....F.....",
      ".......F..",
      ".Hoo......",
      ".###..##..",
      ".......G..",
      "......###."
    ]
  },
  {
    name: "High Shelf",
    optimalMoves: 16,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "...........",
      "...........",
      "....F......",
      "....##.....",
      ".........F.",
      ".Hooo..##..",
      ".###.....G.",
      "........###"
    ]
  },
  {
    name: "Twin Posts",
    optimalMoves: 20,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "...........",
      "...........",
      ".....F.....",
      "...#...#...",
      ".Hooo..F...",
      ".###...###.",
      ".G.........",
      ".###......."
    ]
  },
  {
    name: "Across and Back",
    optimalMoves: 25,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "..........",
      "..........",
      "....F.....",
      "....##....",
      ".Hoo....F.",
      ".###...###",
      ".G........",
      ".###......"
    ]
  },
  {
    name: "Bent Descent",
    optimalMoves: 26,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "............",
      "............",
      "...F....F...",
      "...##...##..",
      "......#.....",
      ".Hooo..F....",
      ".###...###..",
      ".G..........",
      ".###........"
    ]
  },
  {
    name: "Pillar Ladder",
    optimalMoves: 27,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      ".............",
      ".....F.......",
      "...#.........",
      "...#...F.....",
      "..........#..",
      ".Hooo...F....",
      ".###...###...",
      ".G....F......",
      ".###...##...."
    ]
  },
  {
    name: "Canopy Circuit",
    optimalMoves: 27,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "............",
      "............",
      ".....F......",
      "....#####...",
      "...F.....F..",
      "............",
      "..Hoo.#...G.",
      "..###...###.",
      "............"
    ]
  },
  {
    name: "Switchback Orchard",
    optimalMoves: 28,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      "............",
      "............",
      ".F.......G..",
      "...##..###..",
      ".......F....",
      "..F..##.....",
      "..Hoo.......",
      "..###...###.",
      "............"
    ]
  },
  {
    name: "Summit Return",
    optimalMoves: 33,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      ".............",
      ".............",
      "..F......F...",
      "..##....###..",
      ".............",
      "..F....F.....",
      ".....##......",
      "..Hoo.....G..",
      "..###...###..",
      "............."
    ]
  },
  {
    name: "Hanging Harvest",
    optimalMoves: 35,
    firstClearReward: 100,
    replayReward: 25,
    map: [
      ".............",
      "....F........",
      "...###.......",
      ".........F...",
      ".Hooo...###..",
      ".###.........",
      ".......F.....",
      "......###....",
      ".G...........",
      "####..F..####"
    ]
  }
];

  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  return freeze({ snakebird: snakebirdLevels, sokoban: sokobanLevels });
});
