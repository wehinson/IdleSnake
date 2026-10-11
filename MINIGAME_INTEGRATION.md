# Minigame PR2 integration evidence

Combined runtime/test tip: `e30f7c9c9c0475292920421c5a9f9bbe8ee36dd6`. Base: `31e773efee60c85d6781078803e4eae208911e4e`. Docs-only successors reuse this exact-code validation. This remains a proposed PR to `working`; no merge into working/main or deployment is authorized.

## Independently accepted tips

| Owner | Accepted tip | Integration merge |
|---|---|---|
| Snake UI / shared connectors |53bd0593a3ab2dae37b0eec0c65275d902692413|9b58aee|
| Brick / Crossing |0f6aafc43caf3125d21f26d02df1f65c8b2a23f1|f31336d|
| Snakebird campaign |715ac205c0dc00e9fdf4e351723d0aea2ee1f840|fb2224d|
| Sokoban campaign |c664c56f63a55ace76b8ff6e17f036c1bcac0e83|410c429|
| Arcade / Broodline live HUD fix |087fea5174137dfef42ce71b1358a96daaa5454e|6fac4c0|
| Central Seed rewards |707e51f475aa47ed434f4ab0c112014cc78f60a8|ca4e08e|

Full requirements, worker histories and complete published independent verdicts are committed in MINIGAME_BRIEF.md, MINIGAME_WORKER_REPORTS.md, MINIGAME_TASK_LEDGER.md and MINIGAME_COORDINATOR_REVIEWS.md. Failed/cancelled rounds retain their classifications. All six exact tips passed individual gates before their respective integration merges.

## Shared conflict resolutions

- Ready Nibbler sets its requested direction immediately; its subsequent queue path retains Arcade's phase argument for Broodline forward starts. The reward baseline is initialized before input dispatch and advances only on applied movement.
- Crossing death retains queue clearing and `awaitingStart` while settlement uses the central terminal path. Stage wins keep the 1000ms lock, primary-control epoch/pointer/phase guards, queue flush and explicit next Start. Stage-clear overlays now explain terminal payout; intermediate stage currency is removed.
- Breakout's actual paddle-movement event is inside the fixed physics slice, immediately after clamp and before pickups/physics. Outer slices aggregate events, including early termination. The session subtracts unconsumed time before terminal settlement.
- Centipede records actual player movement before bullet/respawn processing; its independent segment clock and fresh/traversed bullet checks remain intact.
- Broodline uses the new combat frame-to-HUD refresh, formation feedback and change-only goals. Its gameover hint guard preserves the central terminal explanation. The obsolete removed Duel-size selector reference was deleted.
- Snakebird campaign2 archive/clear-credit metadata survives the central payout replacement. The two independent 15-board arrays and Sokoban retained-growth-tail legality fix coexist.
- Common connector calls precede segment tiles in all scoped modes, including Runner, transformed Breakout, camera-relative Broodline, Centipede head-separated chains and revealed fleets. Helper, feedback and reward modules load before their consumers.

## Combined verification

One fix-loop lease, three sequential passes, no overlap or stress/browser work. Final `npm run check` passed **475/475 Node tests**, **139 JS syntax checks**, and **11-mode authority/canonical persistence**; no failures, cancellations or skips. `git diff --check` passed. This includes approved tongue behavior and all existing engine/input/drawing/save tests.

New meaningful combined checks in engine/minigame-integration.test.js and scripts/minigame-integrated-rendering.test.js verify all30 campaign witnesses through the real session and central settlement; positive win awards, one receipt per completion, JSON reload/offline continuity, no repeated terminal credit; immediate Ready direction versus cancelled applied-input gating; early sliced Breakout wins/event propagation/run clock; Crossing stage lock/explicit Start/terminal-only credit; and actual shared Breakout connector coordinates, ordering, width, theme mapping and canvas scaling.

Pass1 retained four failures; pass2 retained one. They were compatibility expectations, not changed product rules: Centipede's old terminal bounds were tightened with a one-life natural-loss fixture after enemy slowing; Nibbler's requested Ready display is intentionally visible before its first capped movement tick, so the trace comparison now starts at an applied step; Sokoban checks decimal payout deltas at authoritative currency precision. The fixed-slice reward test additionally verifies no movement event before a physics slice and no event at the clamp. Runtime code is unchanged by these fixture corrections. All positive/neutral/replay assertions remain.

Full logs are retained in the integration Git directory: minigame-combined-2a33d38-pass1.log, minigame-combined-pass2.log, minigame-combined-pass3.log. These logs are local evidence, not committed artifacts; the assertions and witnesses themselves are in the repository.

Light direct HTTP audit: **79/81 asset checks matched exactly with no-store**, including every combined test12 script/stylesheet reference and official theme/puzzle assets. Shared PID14548, route-config hash and original mappings were unchanged; all27 unrelated root-file hashes matched. The only two failures were test1 index/game404: its approved tongue checkout is missing again. Operations was notified for the designated restoration owner; this coordinator does not recreate/remove/rebind it. No Minigame asset mismatch occurred. Audit JSON is retained in own Git directory minigame-final-http-e30f7c9.json.

## Acceptance limitations

The promised final combined independent source/small review is still required before PR handoff. No local browser/computer automation was authorized. Phone scrolling, fullscreen fit, perceived animation/focus, live announcements and human puzzle difficulty require William's manual testing.

Reward calibration and simulated rates are documented in MINIGAME_REWARDS.md. At fixed factors, higher score/wins/income earn more per run and historically low-earned games pay more. A substantial base award and 25% repeat floor can favor quick minimal-progress failures by Seeds/min; existing weak-controller traces show this material balance risk. They are not player percentiles. This PR does not silently retune games or add time gates.

Colony PR1 and release1.0.4 are separate; none of their commits is imported. Package/workflow/release metadata remain unchanged from the working base. The future Colony income increase is consumed only through the existing public query when independently integrated later.
