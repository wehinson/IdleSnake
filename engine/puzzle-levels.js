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
    stage("Opposed Loads", 100, "Solve loads facing opposite walls without boxing in the long body.", [
      "#########", "#21Hpp..#", "#.......#", "#GC...CG#", "#.......#", "#########"
    ]),
    stage("Light Work First", 120, "Move the light crate to reach growth, then prepare the heavy brace.", [
      "#########", "#21H....#", "####cp###", "#p.....##", "#....CG##", "#...G..##", "#########"
    ]),
    stage("Living Bridge", 145, "Keep a body segment on the plate while the head pushes through its gate.", [
      "#########", "#21Hpp..#", "#.....###", "#..a.CAG#", "#.....###", "#########"
    ]),
    stage("Rebrace", 170, "The first shove spends the brace. Coil again before the second shove.", [
      "##########", "#21Hpp...#", "#..#.....#", "#....C.G.#", "#........#", "##########"
    ]),
    stage("Crossed Cargo", 200, "Deliver two heavy crates in different directions through the same workspace.", [
      "#########", "#...G...#", "#...C...#", "#21Hpp..#", "#....CG.#", "#.......#", "#########"
    ]),
    stage("Gatehouse", 235, "Shift the light crate while preserving space for a gated heavy push.", [
      "#########", "#21Hpp..#", "#....cG##", "#..a.CAG#", "#.....###", "#########"
    ]),
    stage("Two Keys", 275, "Body placement must open two gates; collect extra length before crossing.", [
      "##########", "#21Hppp..#", "#.....####", "#.a..CAG##", "#.b...####", "#....CBG##", "##########"
    ]),
    stage("Three Bearings", 320, "Three heavy loads compete for the same turning room and wall anchors.", [
      "##########", "#21Hpp...#", "#....G...#", "#....C...#", "#GC...CG.#", "#........#", "##########"
    ]),
    stage("Long Lever", 370, "Growth extends the plate reach but makes rebracing and turning harder.", [
      "###########", "#21H..p####", "#..#..p####", "#a.....CAG#", "#p.#..p####", "#......####", "###########"
    ]),
    stage("Anchorworks", 430, "Plan the order of three loads, two gates, and two opposing wall braces.", [
      "##########", "#21Hppp..#", "#....c.G.#", "#.a..CAG.#", "#b.......#", "#GC.B....#", "##########"
    ])
  ];
})();
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
