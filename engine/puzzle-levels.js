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
    stage("First Push", 20, "Eat twice; push with your tail against the back wall.", [
      "#########", "#21HppCG#", "#########"
    ]),
    stage("Around the Heel", 35, "Grow down the shaft, then fold around the corner to brace right.", [
      "#########", "#2#######", "#1#######", "#H#######", "#p#######", "#.#######", "#p#######", "#.....CG#", "#########"
    ]),
    stage("Harvest Loop", 45, "Leave the crate, harvest the room, and return with a supported tail.", [
      "#########", "#21H....#", "#..#..p.#", "#....CG.#", "#p......#", "#########"
    ]),
    stage("Ceiling Press", 60, "Build length below the load; turn your tail toward the floor to push up.", [
      "#######", "#..G..#", "#..C..#", "#.....#", "#p...p#", "#21H..#", "#######"
    ]),
    stage("Dogleg Delivery", 85, "A heavy crate must turn the corner; each push needs a different brace.", [
      "########", "#....G.#", "#......#", "#...C..#", "#p..#p.#", "#21H...#", "########"
    ]),
    stage("Light Work First", 100, "Move the light crate to reach growth, then prepare the heavy brace.", [
      "#########", "#21H.####", "####cp###", "#p.....##", "#....CG##", "#...G..##", "#########"
    ]),
    stage("Living Bridge", 120, "Keep a body segment on the plate while the head pushes through its gate.", [
      "#########", "#21Hpp..#", "#.....###", "#..a.CAG#", "#.....###", "#########"
    ]),
    stage("Rebrace", 145, "The first shove spends the brace. Coil again before the second shove.", [
      "###########", "#21Hpp....#", "#..#......#", "#.....C.G.#", "#.........#", "###########"
    ]),
    stage("Crossed Cargo", 170, "Deliver two heavy crates in different directions through the same workspace.", [
      "#########", "#...G...#", "#...C...#", "#21Hpp..#", "#....CG.#", "#.......#", "#########"
    ]),
    stage("Opposed Loads", 200, "Solve loads facing opposite walls without boxing in the long body.", [
      "#########", "#21Hpp..#", "#.......#", "#GC...CG#", "#.......#", "#########"
    ]),
    stage("Gatehouse", 235, "Shift the light crate while preserving space for a gated heavy push.", [
      "#########", "#21Hpp..#", "#....cG##", "#..a.CAG#", "#.....###", "#########"
    ]),
    stage("Two Keys", 275, "Body placement must open two gates; collect extra length before crossing.", [
      "##########", "#21Hppp..#", "#......###", "#.a..CAG##", "#b.....###", "#....CBG##", "##########"
    ]),
    stage("Three Bearings", 320, "Three heavy loads compete for the same turning room and wall anchors.", [
      "#########", "#...G...#", "#...C...#", "#21Hpp..#", "#GC..CG.#", "#.......#", "#########"
    ]),
    stage("Long Lever", 370, "Growth extends the plate reach but makes rebracing and turning harder.", [
      "###########", "#21H..p####", "#..#..p####", "#a.....CAG#", "#p.#..p####", "#......####", "###########"
    ]),
    stage("Anchorworks", 430, "A parked crate blocks the tail anchor. Clear it to finish the gated load, then restore it.", [
      "#########", "#...G...#", "#...C...#", "#21Hpp.##", "#GCa.CAG#", "#......##", "#########"
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
