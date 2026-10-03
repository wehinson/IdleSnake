// Chomp sound rules. The sound is a recorded apple bite; the UI loads and
// plays the file, and this module decides whether and how to play it.
(function attachChompSounds(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeChompSounds = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  // CC0 apple bite by AntumDeluge (opengameart.org/content/apple-bite),
  // played at double tempo with less bass. See assets/sounds/CREDITS.md.
  const chompSoundUrl = "assets/sounds/apple-bite.wav";
  const settings = ["on", "off"];
  const defaultSetting = "on";

  // Earlier builds stored the name of a synthesized sound; any value other
  // than "off" now means the chomp is on.
  function normalChompSetting(value) {
    return value === "off" ? "off" : defaultSetting;
  }

  // The file to play for one eat, or null when the chomp is off.
  function chompForEat(setting) {
    return normalChompSetting(setting) === "off" ? null : chompSoundUrl;
  }

  // A small pitch change per eat so that repeated chomps do not sound identical.
  function chompPlaybackRate(rng = Math.random) {
    return 0.94 + rng() * 0.12;
  }

  return { chompSoundUrl, settings, defaultSetting, normalChompSetting, chompForEat, chompPlaybackRate };
});
