// Authored timed Nibbler campaign. Final designer comparison/witnesses follow.
(function attach(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeMazeLevels = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const map = Array.from({ length: 21 }, () => Array(21).fill("#"));
  for (let n = 3; n <= 17; n += 1) { map[3][n] = "."; map[17][n] = "."; map[n][3] = "."; map[n][17] = "."; }
  [[5,3],[8,3],[11,3],[14,3],[17,3],[17,6],[17,9],[17,12],[17,15],[17,17],[14,17],[11,17],[8,17],[5,17],[3,17]].forEach(([x,y]) => { map[y][x] = "S"; });
  map[4][3] = "H"; map[5][3] = "o"; map[6][3] = "o";
  const levels = [{ id: "first-circuit", name: "First Circuit", direction: "up", map: map.map((row) => row.join("")), witness: "U1,R14,D14,L14", difficulty: 1, rationale: "Introductory corner steering and a full growing circuit." }];
  return { levels };
});
