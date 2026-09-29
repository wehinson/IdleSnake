# Snake frame benchmark (2026-09-29)

Run `npm run serve` in one terminal, then run `node scripts/benchmark-snake-frame.js benchmarks/new-run.json` in another. The script uses generated saves in a private Chromium browser context. It does not read a personal save. It records raw `requestAnimationFrame` gaps and Chrome performance metrics for three 4-second runs at 1x and 6x CPU settings. The JSON files record the browser and Node versions. The developed save has four established settlements, with 24 hatchlings, 8 retained Notables, and many habitats per settlement. The same script and fixture were used for each saved result.

| Stage | Code commit | Developed 6x median p95 frame gap | Median frames over 50 ms | Full snapshots per 4 seconds at 1x | HUD mutations per 4 seconds at 1x |
| --- | --- | ---: | ---: | ---: | ---: |
| [Baseline](snake-frame-baseline.json) | `94c2ae7` | 66.6 ms | 11 | 738 | 968 |
| [Motion read](snake-frame-motion.json) | `a73644b` | 50.0 ms | 3 | 16 | 968 |
| [Conditional HUD writes](snake-frame-hud.json) | `08cb88d` | 33.4 ms | 2 | 16 | 4 |

Each value is the median of three runs. These short runs show lower measured work and fewer long frames, but the frame timing is variable. They do not establish the same gain on other computers or saves. The motion read removed a full save snapshot from ordinary drawing. The HUD change removed stable DOM writes from ordinary drawing.

The [cache experiment](snake-frame-rejected-cache.json) is kept as a negative result. It used an uncommitted economy activation cache after the HUD change. Its developed 6x median p95 was 50.0 ms, with 6 frames over 50 ms. One developed 1x run ended in game over, so that result is not a controlled comparison. A separate 80-check old/new state comparison passed, but direct tick timing varied in both directions. The cache was removed.

The benchmark collects frame presentation gaps, not exact Snake movement times. A 4-second path can collect random food or reach the wall, so inspect each result's `phase` and repeat any comparison that needs a longer stable path. No profiler was active during the saved runs.
