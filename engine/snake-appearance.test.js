const test = require("node:test");
const assert = require("node:assert/strict");
const { connectorWidth, connectorMinimumWidth, connectorLightening, connectorColor } = require("./snake-appearance.js");

test("connectors are fifteen percent brighter and twenty-five percent thinner", () => {
  assert.equal(connectorWidth, 0.46 * 1.5 * 0.75);
  assert.equal(connectorMinimumWidth, 3 * 0.75);
  assert.equal(connectorLightening, 0.15);
  assert.equal(connectorColor("#29391f"), "#2f4224");
  assert.equal(connectorColor("#16465a"), "#195168");
  assert.equal(connectorColor("#ffffff"), "#ffffff");
});
