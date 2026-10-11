# Minigame PR2 integration and review record

Updated: 2026-10-11. Status: implementation in progress; no implementation accepted or merged; no PR yet.

## Boundaries and resume instructions

- Coordinator: `mcp:618042fc-9354-4fc9-906a-1b3ca5c689e4`, local Jimothy, GPT 6.1 Sol high effort. Integration: `task/minigame-batch-20261011`, this checkout.
- Base: `31e773efee60c85d6781078803e4eae208911e4e` on local `working`; approved tongue behavior included.
- Separate baseline-only release evidence: `main`/`origin/main` at `0f148ad1af6b6d288cb67d956f3d9a6e851fa003`, version1.0.4; parents previous main `9d83dd25e2c066fa8231e5efa825755a0513f077` and metadata `4a3e41413f23be3fbe1bb79e0673a47abf4c8c2d` (parent baseline31e773e). Diff from baseline only package.json/package-lock.json/BRANCHES.md/RELEASE_STATUS.md. Local `working` remains31e773e. Release thread reports live1.0.4 and64 runtime asset hashes match main; CI/deployment completion still being verified. No batch commits imported; Minigame remains unapproved and separate, based on31e773e. Do not copy release commits or change batch version just for PR; eventual metadata integration requires care.
- Exactly one minigame PR targeting `working`. Colony PR1 is separate, owned by `mcp:4179fc65-6476-4132-ab6c-582e4df713e3` on `task/colony-batch-20261011`. Never import Colony branch commits or merge either PR automatically. No working/main merge, deployment, or release bump.
- Full original requirements: [MINIGAME_BRIEF.md](MINIGAME_BRIEF.md). Numbering skips 7: twelve groups (1–6, 8–13), not fourteen.
- Six existing workers only; do not duplicate. Resume on their completion messages. After all implementations return, independently inspect each exact diff and execute meaningful direct checks; obtain T3 read-only independent review per branch with full original brief and exact commit. Reviews alone and green unit tests alone are insufficient.
- Fix findings in original worker threads. Each new review round uses a fresh `delegate_task`, original brief + prior findings/fixes/unresolved objections, a new stable request ID, GPT 6.1 Sol with effort chosen at creation. Record actual task IDs and reviewed tips here. Never use reviewer child storage thread for another round.
- Merge passed exact tips only into this integration branch. Resolve shared files semantically, re-run combined checks/witnesses, verify switching/locks/state/save/reward invariants. Preserve all existing CI/browser tests and root unrelated balance work. No browser/computer automation authorized; report visual verification gap.
- MCP tools for this binding are `mcp__t3_code__*`; similarly named `mcp__t3__*` tools answered target_required and are not this client. Live catalog confirmed local codex / gpt-6.1-sol and reasoningEffort options.
- Final PR must be linked using `link_pull_request` here and home `915f73b5-2a00-44c0-ad8b-61e81d820388`; audit `list_thread_pull_requests`. Send home mode auto, stable completion key `minigame-batch-review-pr-20261011`, with URL, exact reviewed commits, tests, preview, concerns, check state. Home owns CI watching; do not run a watcher.

## Ownership and completion gates

All current worker tips equal baseline; final tips pending. Independent review task IDs pending.

| Owner / requests | Branch | Thread | Reserved preview | Completion gate |
|---|---|---|---|---|
| Snake UI: 1,2,12,13 | task/minigame-snake-ui-20261011 | mcp:30aa62db-38dd-45af-a2d2-05b177b3a30f | /test6/ | Both duel snakes wrap, fixed20x25/migration, AI/collisions, connected body/grid-only/black pulsing Seeds; Nibbler naming/start directions without duel rules; one-click selectors/fullscreen; all segment renderers and wrapped seam tests |
| Brick/crossing: 3,4 | task/minigame-brick-crossing-20261011 | mcp:792ca7d4-1068-4df9-89af-466c4b36398d | /test7/ | Last-tail5s/2s warnings/reset/reduced motion; circle/no grid/all motion1.5x/collision; four tall brick rows HP/colors/fractures; pickups; independent logs1/1.25/1.5625 speed/overtake/occlusion; explicit start after win lock; length |
| Snake Bird: 5 | task/minigame-snakebird-levels-20261011 | mcp:56e9050b-4db2-47a7-b547-11d09cb0ad4a | /test8/ | Exactly15 varied increasingly difficult levels; two medium read-only T3 design tasks; real engine witnesses, legality/fruit/gravity/escape tests; safe old progress; attribution |
| Sokoban: 6 | task/minigame-sokoban-levels-20261011 | mcp:33616d55-5674-4e78-9652-e3953e91dcea | /test9/ | Exactly15 escalating creative growth/wall-brace levels; witnesses and necessity evidence/counterexamples; progression/save compatibility |
| Arcade: 8,9,10 | task/minigame-brood-strike-centipede-20261011 | mcp:45560e22-c632-4a49-83e5-4d71d479a2cd | /test10/ | Bounded Broodline improvements with rationale/outcomes; both strike boards full available width, transforms/aspects/feedback/reduced motion; concrete centipede cadence/speed tuning, health opacity1/.85/.70/.55, darker obstacles, larger fair player |
| Rewards: 11 | task/minigame-rewards-20261011 | mcp:f8d8c6c9-6d22-4054-af48-c6768be37465 | /test11/ | Single authoritative calibrated formula, win/score/historical earnings/passive income/small seeded randomness, all payout modes inventoried, exactly once/no idle payout, migration/determinism/finite bounds/examples/balance simulation, succinct UI |

## Shared interfaces and interpretations

- Connector owner supplies `scripts/snake-connectors.js`: UMD `IdleSnakeConnectors.draw(ctx, points, {cellSize,x,y,color,columns,rows,wrap=false,tailBaseDistance=0})`. Points are cell coordinates, fractional allowed; helper uses existing appearance widths/color and only adjacent links. Wrap uses clipped seam stubs, never a cross-board line.
- `game.js` wrapper `drawSnakeConnectors(points, color=snakeColors.body, options={})` applies theme color and merges board metrics/grid defaults with supplied options. Helper also supports optional `width`. Call before body tiles; pixel snakes may normalize centers to their segment pitch. Final ownership: Snake handles generic/default/Duel/Nibbler/Bird/Sokoban; Brick handles Breakout/Crossing; Arcade handles Centipede (split at isHead), Broodline and revealed Battleship. Bird owns no renderer edit. Helper is loaded from index.html; worker tests pending.
- Reward owner owns all session payouts/history/save hooks and minimal reward explanation. Others supply outcomes and coordinate narrow session changes. Snake Bird progress bookkeeping must not retain legacy second payout. Crossing win lock and centipede cadence must coexist with reward hooks.
- Arcade owner may expand battleship canvas with mode-specific aspect/full-width square10x10 boards. Generic metrics stay stable; coordinate resize wrapper with Snake owner and test pointer transforms directly.
- Crossing currently uses moving `cars` as road obstacles, with no water/support mechanic. Worker treats these as requested logs, retaining central obstacle rules; accepted bounded interpretation, must be stated in final report.
- Sokoban already has a heavy push mechanic requiring length>=5 and a tail brace against a wall. Starting length3 means at least2 pellets needed. Worker edits Sokoban array plus necessary scoped engine legality fix; Bird edits Snakebird array only. Existing Sokoban has no durable level index; do not invent save migration unnecessarily.
- Sokoban design review found a reachable occupancy defect: pushing a crate onto the old tail while eating a pellet retained that tail. Worker will determine growth before collision validation and include the retained tail; preserve existing wall brace and pre-move plate/gate rules. Gates can close around occupants (departure permitted, closed entry blocked). Review requires pre-fix reachable regression witness, fixed rejection without mutation, legal non-growing push control, and no body/crate/solid overlaps throughout all15 replays. No new mechanic or session edit.
- Reward brief says all9 modes, while session exposes11 including classic and runner. Explicitly inventory all payout-capable minigames, including runner, rather than omit modes by a mistaken count.

## Research and independent review ledger

| Owner | Research request key / task ID | State |
|---|---|---|
| Brick/crossing | brick-crossing-research-20261011 / node:delegated-task:command%3Amcp%3Afcb04b09-0c64-4e54-b229-5ca419397a16%3Adelegate-task%3Abrick-crossing-research-20261011 | running |
| Arcade | minigame-8910-research-20261011 / node:delegated-task:command%3Amcp%3A93dc784f-daa8-41f9-bb77-f0df835d0be8%3Adelegate-task%3Aminigame-8910-research-20261011 | running |
| Rewards | minigame-rewards-research-r1-20261011 / actual task ID requested | running, high effort |
| Snake Bird layout | snakebird-layout-design-20261011 / node:delegated-task:command%3Amcp%3Ad06fc682-c68b-4a36-9dd7-4457cda6bf62%3Adelegate-task%3Asnakebird-layout-design-20261011 | completed, medium; eight original legal maps, optimal9–35 moves, shelves/posts/returns/low hanging fruit; parent replays verified |
| Snake Bird mechanics | mechanics-design / actual task ID requested | running, medium effort |
| Sokoban | read-only design review actual task ID pending | review found reachable retained-tail growth/crate overlap; scoped legality fix/regression and15 curated witnesses in progress |

Each final worker report must include exact pushed tip, owned files, acceptance evidence, targeted checks, full check results, actual research task IDs/results, migration decisions and risks. Stable completion message requested from all six.

## Verification and previews

- Baseline `npm run check`: passed syntax118 JS files, authority11 modes, 335/335 Node tests. Integration initially clean, exact base confirmed.
- Shared server PID10940 command: node `C:/Code/IdleSnake/.git/shared-test-server.cjs`, reads `.git/local-test-routes.json` per request. Root is `C:/Code/IdleSnake`. Relative index/assets isolate each checkout; no process restart required.
- Existing routes preserved: test1 approved tongue; test2 seed turn; test3 Colony UI; test4 Colony economy; test5 Colony integration. Minigame test6–test11 worker routes and test12 integration LIVE. Colony coordinator confirmed exclusive append allocation; config written atomically with original values preserved. 78 exact HTTP byte comparisons passed across root/all12 routes for index.html, game.js, styles.css, engine/session.js, engine/puzzle-levels.js and themes/theme-kit.js; all slash redirects passed. No server restart. Detailed SHA256 evidence and original config in ignored integration git directory. test12 is still baseline, not integrated gameplay.
- Root balance changes excluded: modified CI/README/package plus untracked balance workflow/brief/script/simulation tree. All27 files captured in SHA256 hash manifest in ignored integration git directory; compare before handoff. Never import those files or alter CI.
- Visual gap: phone/fullscreen layout, canvas appearance, perceived animation/control feel and accessibility need William's manual test. Direct engine/drawing/HTTP checks do not establish those visual results.

## Integration ledger

No worker tips accepted, no merges, no PR. Await implementation completion callbacks; retain scope and resume review automatically.
