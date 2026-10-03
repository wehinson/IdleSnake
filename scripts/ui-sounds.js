// Button click sounds. Phone buttons and main menu buttons each have their own sound.
// pickUiSound is pure so it also runs in Node; attachUiSounds binds it to the page.
(function attachUiSounds(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeUiSounds = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const UI_SOUNDS = {
    phone: { src: "assets/audio/phone-double-tap.wav", gain: 0.55 },
    menu: { src: "assets/audio/menu-click-el-boss.mp3", gain: 0.6 }
  };
  const SIDE_SELECTORS = { phone: ".phone-shell", menu: ".menu-panel" };

  // input: { side: "phone" | "menu" | null, disabled, trigger: "pointer" | "keyboard" | "pointer-click" }
  function pickUiSound({ side, disabled = false, trigger = "pointer" }) {
    if (!side || !UI_SOUNDS[side] || disabled) return null;
    // A pointer press already played its sound; the click that follows it is silent.
    if (trigger === "pointer-click") return null;
    return side;
  }

  function sideOf(button) {
    for (const [side, selector] of Object.entries(SIDE_SELECTORS)) {
      if (button.closest(selector)) return side;
    }
    return null;
  }

  function attachUiSounds(doc = document, win = window) {
    const AudioContextClass = win.AudioContext || win.webkitAudioContext;
    if (!AudioContextClass) return null;
    const context = new AudioContextClass();
    const buffers = {};
    Object.entries(UI_SOUNDS).forEach(([side, sound]) => {
      win.fetch(sound.src)
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data))
        .then((buffer) => { buffers[side] = buffer; })
        .catch(() => {});
    });

    function play(side) {
      if (context.state === "suspended") context.resume().catch(() => {});
      const buffer = buffers[side];
      if (!buffer) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = UI_SOUNDS[side].gain;
      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      source.start();
    }

    function handle(event, trigger) {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button) return;
      const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
      const side = pickUiSound({ side: sideOf(button), disabled, trigger });
      if (side) play(side);
    }

    // Capture phase: some buttons act on pointerdown and stop propagation.
    doc.addEventListener("pointerdown", (event) => {
      if (event.button === 0) handle(event, "pointer");
    }, true);
    // A click with detail 0 comes from the keyboard (Enter or Space on a focused button).
    doc.addEventListener("click", (event) => handle(event, event.detail === 0 ? "keyboard" : "pointer-click"), true);
    return { play };
  }

  if (typeof document !== "undefined" && typeof window !== "undefined") attachUiSounds();
  return { UI_SOUNDS, pickUiSound, attachUiSounds };
});
