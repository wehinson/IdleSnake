const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { UI_SOUNDS, pickUiSound } = require("./ui-sounds.js");

test("phone buttons use the double tap and menu buttons use the el_boss click", () => {
  assert.equal(pickUiSound({ side: "phone" }), "phone");
  assert.equal(pickUiSound({ side: "menu" }), "menu");
  assert.match(UI_SOUNDS.phone.src, /phone-double-tap\.wav$/);
  assert.match(UI_SOUNDS.menu.src, /menu-click-el-boss\.mp3$/);
});

test("keyboard activation plays and the click after a pointer press stays silent", () => {
  assert.equal(pickUiSound({ side: "menu", trigger: "keyboard" }), "menu");
  assert.equal(pickUiSound({ side: "phone", trigger: "pointer-click" }), null);
});

test("disabled buttons and buttons outside both sides are silent", () => {
  assert.equal(pickUiSound({ side: "menu", disabled: true }), null);
  assert.equal(pickUiSound({ side: null }), null);
});

test("sound files exist", () => {
  for (const sound of Object.values(UI_SOUNDS)) {
    assert.ok(fs.statSync(path.resolve(__dirname, "..", sound.src)).size > 0, sound.src);
  }
});
