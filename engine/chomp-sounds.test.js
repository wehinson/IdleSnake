const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chompSoundUrl, settings, defaultSetting, normalChompSetting, chompForEat, chompPlaybackRate } = require("./chomp-sounds.js");

test("the chomp sound file is a short mono WAV in the repository", () => {
  const file = fs.readFileSync(path.join(__dirname, "..", chompSoundUrl));
  assert.equal(file.toString("ascii", 0, 4), "RIFF");
  assert.equal(file.toString("ascii", 8, 12), "WAVE");
  assert.equal(file.readUInt16LE(22), 1);
  const seconds = (file.length - 44) / file.readUInt32LE(28);
  assert.ok(seconds > 0.2 && seconds < 0.6, `${seconds} s`);
});

test("the setting turns the chomp on or off", () => {
  assert.deepEqual(settings, ["on", "off"]);
  assert.equal(defaultSetting, "on");
  assert.equal(normalChompSetting("off"), "off");
  for (const old of [undefined, null, "bogus", "crunchy", "random"]) assert.equal(normalChompSetting(old), "on");
  assert.equal(chompForEat("on"), chompSoundUrl);
  assert.equal(chompForEat("off"), null);
});

test("each eat changes the pitch by at most six percent", () => {
  assert.equal(chompPlaybackRate(() => 0), 0.94);
  assert.ok(Math.abs(chompPlaybackRate(() => 1) - 1.06) < 1e-12);
});
