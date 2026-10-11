# Snake Forever nine-change batch review

Updated: 2026-10-11. Coordinator: GPT 6.1 Sol, high effort, local Jimothy.

- Integration thread: `mcp:4179fc65-6476-4132-ab6c-582e4df713e3`.
- Integration checkout: `C:/Users/wehin/.t3/worktrees/IdleSnake/task-colony-batch-20261011`.
- Branch: `task/colony-batch-20261011`; baseline: `31e773efee60c85d6781078803e4eae208911e4e` (local active working at launch).
- Home: `915f73b5-2a00-44c0-ad8b-61e81d820388`. Final handoff request ID: `colony-batch-review-pr-20261011`.
- Deliver one PR targeting `working`. No merge into working/main, deployment, release bump, unrelated workflow changes, browser automation, or computer use.
- Preserve root checkout balance work (.github workflows, README/package, simulation/, scripts/balance.js); never copy its uncommitted changes into this branch.
- Claims apply per worktree. Remove this coordinator's claim at each turn completion.

## Existing workers (do not duplicate)

| Scope | Branch | Thread | State | Reviewed commit / task IDs |
| --- | --- | --- | --- | --- |
| 1, 6, 7, 9 UI | task/colony-ui-20261011 | mcp:4ee92de7-753a-47f6-84bd-7027e32edf3e | Round 2 PASS owned scope; economy integration condition pending | Accepted UI tip 6cb9d3a9b186364fd0887ff8fbe9fee6628eecf5 |
| 3, 4, 5, 8 economy | task/colony-economy-20261011 | mcp:fd026147-88dc-4aae-8b42-576f1e265fa6 | Round 2 changes required; freeze released, worker fixing | Rejected candidate 7f75b34116ae2763aeecd7b36f99d82f132482b8 |
| 2 Seed grace | task/seed-turn-grace-20261011 | mcp:57410d23-3950-46db-933b-7d760f1a72ce | Round 3 review running | New candidate e9818bb723f2e61310c85e3dfb1b631f162a947c |

Each checkout is a sibling under `C:/Users/wehin/.t3/worktrees/IdleSnake/`. Workers send completion here with stable request IDs `colony-ui-20261011-complete`, `colony-economy-20261011-complete`, `seed-turn-grace-20261011-complete`.

## Acceptance conditions

1. Length bonus beside income, numeric portion yellow; preserve HUD labels and all themes/small layouts.
2. Classic Snake retains heading at/after 85% of tick before entry into a Seed. Before 85% steering remains normal. Keep latest legal turn for after Seed entry when safe; no duplicate steps/rewards. Restriction excludes empty squares, other targets/modes. Verify 84.9/85/99%, speed variants, legal/illegal inputs, timestamps, late correction, pause, deterministic stepping and approved tongue Seed return compatibility.
3. Hatchlings mature by elapsed time with zero Seeds, no feeding gate or Seed deductions. Preserve eggs, durations, saves and offline/catch-up; adult upkeep stays.
4. All Colony Seed/Branch/Provision production is ten times baseline, once, preserving modifiers/Notables/length order. Costs, consumption, stockpiles, eggs, food rewards and hatch-time effects are not scaled.
5. First habitat accessible; later habitat unlock/display requires five snakes in immediately previous habitat with dependency chain. Authoritative placement/upgrades enforce condition. Show `Next habitat in X Snakes` below last regularly available habitat, X=max(0,5-previous count). Verify 4/5 thresholds, chain, migrations and settlements; preserve legacy populations/save data.
6. Every habitat secondary byline uses current authoritative effect/rate, signed `Effect: +X Resource/Time` or `Effect: -X Effect/Time`; correct units including nonproduction hatch reductions. No invented effects or stale literal rates.
7. Notables: back top left to Colony; plain `(x/y)` top right. Zero candidates hides candidate area; one compact square candidate with Keep/Reject below when pending. Full queue remains engine-owned and is handled sequentially. Preserve accept capacity/rejection/replacement semantics, pending badge, functional labels/accessibility and assignments. No queue controls/redundant instructions. Roster Unassign and red Dismiss side by side; preserve served leaders' Retire versus unserved Dismiss behavior.
8. Eligible assigned Notables accrue real service even when effect output is zero. No render accrual/duplicates. Verify pause/offline/unassign/reassign/settlement behavior. Compact UI refreshes labels appropriately.
9. Remove Colony consumption tracking displays and abandoned controls/gaps; retain adult consumption mechanics.

## Coordination decisions to verify

- Economy owns habitat build/render progression portions in game.js. UI owns Notables/HUD/effect labels, obsolete nursery feeding display removal and service refresh in syncPanels (in-place labels, avoid per-tick roster rebuild).
- Keep activation.perSnakeRates as scaled production; add activation.upkeepPerSnakeRates for unchanged adult costs and habitatProvisionOutputs for producer labels. habitatPanel exposes per-habitat seedRate/branchRate/provisionRate/foragerRate and base/current effect fields; eggHatchReduction is not scaled.
- Proposed save compatibility: occupied legacy higher habitats keep their populations and production, are displayed explicitly as legacy/blocked, and cannot accept placement/upgrades until preceding five-snake chain restored. Empty locked habitats remain hidden. This needs independent review evidence.
- Service accrual continues with passive economy during pause/offline, consistent with existing mechanics; assigned populated habitat eligibility independent of effect totals.
- Economy confirms habitatPanel.seedRate includes length bonus and owns the overview totalIncome one-line update. Preserve it alongside UI byline changes when resolving shared renderHabitats.
- Existing browser scenarios must follow intentional UI changes without losing coverage: UI owns notable-candidates.spec.js sequential Keep/Reject updates; economy owns feeding-control expectation updates in fullscreen-mode.spec.js and snake-batch.spec.js. These run in existing GitHub CI only; no local browser permission.

## Worker evidence received (not yet independently accepted)

- UI reports direct Node VM checks of actual renderer plus engine: pending transitions 7→6→5→4→3→0, exactly one visible card, capacity-rejected Keep preserves candidate, Reject, Dismiss preserves queue, Unassign, served replacement archives leader, badge/count and hidden zero state. Service refresh retains control DOM identity and updates Retire label. Reports 35 targeted engine tests passed and baseline npm run check passed 335 tests. Exact committed tip and independent review remain pending.
- Seed completed/pushed tip `e4032fe0677dd8b3401ac541255449c0c7049979`; coordinator confirmed branch identity and clean task worktree. Worker reports syntax/authority plus 350 Node tests passing, including 15 new Seed acceptance cases; diff whitespace and six `/test2/` HTTP asset comparisons passed. Scope: session.js, snake.js, seed-turn-grace.test.js, timestamp adjustment in retained snake-batch correction test, BRANCHES.md. No browser use. Full acceptance includes 84.9/85/99%, imminent buffered heading, latest legal request surviving invalid follow-ups, full buffer precedence, post-pickup safe release, pause/save/reload/speed changes, timestamp correction and deterministic slices, approved tongue compatibility. These are worker claims until coordinator checks and independent review.
- Seed buffering caveat to review explicitly: existing earlier legal turns retain precedence; unsafe deferred request is discarded at canonical pickup. Grace request is separate from tongue presentation queue. Pre85% delayed input retains 34ms correction; at/after85% replay preserves consumption/rewards and omits movementCorrected tongue-reset event. Branch must not drift without requested review fixes.
- UI completed/pushed `082ac59b7c46bb13be9dcd85e49b101af641def8`; coordinator confirmed identity and clean worktree. Six files: game.js, index.html, styles.css, tests/browser/notable-candidates.spec.js, scripts/check-colony-ui.js, BRANCHES.md. Reproduce VM acceptance with `node scripts/check-colony-ui.js` in UI checkout; worker reports all candidate/service scenarios above plus current Seed/Branch/Provision/Lake effects and tiny nonzero rate precision. Targeted `node --test engine/notables.test.js engine/length-bonus.test.js engine/ui-boundary.test.js` reports 35/35; npm run check reports 335/335 plus syntax/authority; diff whitespace and route HTTP page/game/CSS checks passed. Not independently accepted yet.
- UI effect semantics: provisionRate + (foragerRate default 0), Lake `-X Hatch Sec/Egg`; seedRate expects length included by economy. Preserve economy progression, totalIncome=panel.seedIncomePerSecond and `.habitat-card[hidden]` during integration. Service labels update in place and hold callback reads current hasServed; replacement/Retire semantics remain. Browser specs, focus, narrow geometry and all theme fit remain unverified locally.
- Economy progress (final tip pending): worker reports 346/346 Node tests, syntax 119 JS and authority 11 modes. New 11-case colony-progression suite covers zero-food time-only maturation online/offline/persistence, output/modifier/cost separation, 4/5 chain, legacy populations/reduced-save relock, founding/established settlements, zero-effect service/pause/offline/unassign/reassign/read-no-accrual and migration high-water marks. No live removal action exists, so prerequisite reduction uses canonical saved economy. Feeding browser expectations adapted but require UI removal; not executed locally.
- Economy final completed/pushed tip `3e8d01e58ed641999c9da6f2551fa9c7fcfdc4cc`; commits bf5c544 (engine/tests) and 3e8d01e (progression/spec/log). Worker reports final targeted 138/138, npm run check 346/346, clean worktree and exact remote. Existing 15-minute maturation and 5/10-minute milestones preserved; historical resource/service totals untouched; passive pause/offline service requires assigned working populated habitat in established settlement. Faster output intentionally supports more adult upkeep/eggs.

## Independent coordinator checks and delegated reviews

- All workers returned before checks/reviews began. Coordinator inspected each diff against baseline, including adapted existing tests and cross-branch interfaces.
- Exact-tip individual `npm run check` reruns passed: Seed 350/350, UI 335/335, economy 346/346; all syntax/authority checks passed, no skips/failures. UI `node scripts/check-colony-ui.js` independently passed candidate/service/effect acceptance. Diff whitespace checks passed; all task worktrees clean.
- Refreshed direct HTTP verification: 12 assets each on /test2, /test3, /test4 match frozen checkout tips. All 27 protected unrelated root-file hashes still match baseline.
- Three T3-owned read-only reviews launched with local provider codex/model gpt-6.1-sol/reasoningEffort high selected at creation. Each prompt contains original worker brief verbatim, full batch acceptance reference, worker claims, coordinator evidence and concrete concerns. No nested reviewers/browser execution authorized. Completion wakes coordinator; no polling monitors.
- Coordinator concerns sent for review, not yet accepted findings: mixed-resource Notable contribution totals still labeled Seeds; next-habitat message appended below visible legacy cards rather than immediately after last regularly available habitat.

| Review | Stable clientRequestId | taskId | State |
| --- | --- | --- | --- |
| Seed round 1 | colony-batch-seed-review-r1-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-seed-review-r1-20261011 | Changes required: two P2 defects |
| UI round 1 | colony-batch-ui-review-r1-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-ui-review-r1-20261011 | Changes required: two UI fixes, two economy dependencies |
| Economy round 1 | colony-batch-economy-review-r1-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-economy-review-r1-20261011 | Changes required: P1 offline scheduler, P2 progression and stats wording |
| UI round 2 | colony-batch-ui-review-r2-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-ui-review-r2-20261011 | PASS owned scope at 6cb9d3a; economy Lake dependency |
| Seed round 2 | colony-batch-seed-review-r2-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-seed-review-r2-20261011 | Changes required: P2 request-time progress across speed/pause |
| Economy round 2 | colony-batch-economy-review-r2-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-economy-review-r2-20261011 | Changes required: funded scheduler, authoritative Lake, fractional deadlines |
| Seed round 3 | colony-batch-seed-review-r3-20261011 | node:delegated-task:command%3Amcp%3Abcd63630-411c-4aec-8b6f-4afac57f78e2%3Adelegate-task%3Acolony-batch-seed-review-r3-20261011 | Running against e9818bb |

### Seed round 1 findings and response

- Reviewer independently passed npm run check 350/350 and grace/batch 28/28, but found two uncovered P2 defects. Coordinator independently reproduced both with direct Node checks.
- Delayed latest grace request behind earlier buffered turns: head(10,10) right, Seed(10,9), 200ms tick; queue up,left at100ms, defer down at170ms, then up timestamp198ms. On-time delivery yields left,up; delivery at205ms rejects invalidDirection and leaves left,down. session.js eligibility excludes buffered movement, bypassing protected replacement. Fix must preserve earlier precedence and identical pickup/rewards for delayed legal input.
- Future-body prediction ignores subsequently spawned food: body(10,10),(9,10),(9,11),(10,11),(11,11),(11,10),(11,9),(11,8),(10,8),(10,7); right heading, queue up,left,up, deferred right, foodCountLevel1, Seeds(10,9),(9,9), RNG0,0.4228240862476992,0. Current code accepts deferred right; buffered pickups spawn/eat(9,8), additional growth causes collision at(10,8). Fix must revalidate authoritative geometry before deferred execution without speculative RNG draws.
- Full findings sent to original Seed thread mode auto with stable request ID `colony-batch-seed-r1-fixes-20261011`. Worker must add regressions, rerun checks, push new tip and report. New delegate_task round will include original brief, prior findings and fix response. Do not merge this rejected tip.

### Economy/UI round 1 findings and ownership

- Economy reviewer passed 346 tests, syntax119/authority11, 960 baseline/tip activation comparisons (10x production, unchanged upkeep/Lake), correction service234ms without duplicates and HTTP identity. Required P1 fix: recurring online/offline nursery production differs. Save time1000, zero currencies, counts[5,5,5,25], 3600 live one-second ticks yields6 adults/9eggs/2hatchlings versus one offline hour1adult/2eggs/0hatchlings, currencies equal. Coordinator independently reproduced exact results. Outer economy scheduling must reconsider egg creation as incubation/graduation frees space, preserving egg timing/backpressure and no repeated catch-up accrual.
- Economy-owned P2: actual VM DOM for counts[4,5,2,1] places Next habitat in1Snakes after Field/Lake/Forest/River; only Field regularly unlocked. Move progress immediately after last regularly unlocked card, retain legacy occupants/notices.
- UI-owned P2 (both reviewers confirmed): Forest1/Production+50% contributes0.05Seed+0.05Branch/sec but aggregate0.1 displayed as bonus Seeds; Rationer similarly mixed. Use resource-neutral aggregate wording, preserve historical saved totals; no inferred breakdown from current assignment.
- UI-owned P2: smoke.spec.js retains obsolete Lake/Forest/River wording. Adapt actual-current effect assertions without removing habitat/smoke coverage; account for integration fresh locked habitats hidden with suitable fixture.
- Economy-owned P2 found by UI reviewer: Lake330snakes/upgrade9 displays raw-330HatchSec/Egg while actual300second base egg has0duration; query must expose capped effective300seconds. Preserve raw mechanics; test against engine egg duration.
- Economy-owned P2: working-followup.spec.js HUD retains+0.1375/s/+0.1581/s against actual1.375/1.58125; adapt10x expectations preserving purchase/pause/death/narrow coverage. Browser scenarios remain CI-only.
- UI review passed script,35 targeted tests,335 check tests and whitespace; candidate/service control behavior passes. All three original frozen candidates stayed clean/no drift during reviews.
- Fix routing request IDs: `colony-batch-economy-r1-fixes-20261011`, `colony-batch-economy-ui-r1-findings-20261011`, `colony-batch-ui-contribution-r1-fix-20261011`, `colony-batch-ui-r1-fixes-20261011`. Original workers now fixing, no candidate approved/merged. Each changed tip needs fresh independent review round with original brief/findings/responses.

### Seed/UI fixes and round 2 evidence

- UI returned clean/pushed `6cb9d3a9b186364fd0887ff8fbe9fee6628eecf5`, after dcd4134 resource-neutral wording plus unchanged-total actual string checks. Smoke scenario retains controls/config/cards/cells/nursery/tail coverage and asserts current nonzero bylines with occupied legacy counts[0,2,3,4,0,0,0,0], independently deriving small-population rates from config. Parent inspected changed diff, reran actual UI script (all pass) and npm run check335/335 plus syntax/authority/whitespace. Lake cap and working-followup numerical adaptation remain economy-owned dependencies.
- Seed returned clean/pushed `aabbea2cc15edbcbb42290c09d7beb49a62a4d62`. Buffered protected replay now uses original final buffered heading within34ms; on-time/delayed0/5/16/34ms snapshot/save/RNG/event regression added. Speculative future body forecast replaced saved optional queue-index guards that revalidate actual geometry when deferred turn executes, discard unsafe turn and revalidate dependent inputs without speculative RNG. Exact old food/body/RNG reproduction now3pickups/13segments/3draws, safely continues9,7. Multiple guards/core-step reload/session slices/saves covered; five new regressions retain prior15cases. Parent inspected changed diff and reran npm run check355/355 plus syntax/authority/whitespace.
- Fresh UI and Seed delegate_task round2 prompts include original brief verbatim, prior worker/parent evidence, all findings and new responses, exact new frozen tips and unresolved economy dependencies. All same local codex/gpt-6.1-sol/high creation settings; task IDs above. Await automatic completion, no polling.

### Economy fixes and round 2 evidence

- Economy returned clean/pushed exact `7f75b34116ae2763aeecd7b36f99d82f132482b8`; fix commits29d7fc8(engine scheduler/Lake regressions) and7f75b34(progress/HUD/directUI/log). Parent inspected fix delta and new engine/UI regressions; independently npm run check351/351 plus syntax/authority/whitespace passed.
- Parent independently reran the original one-hour fixture: live/offline now exactly match6adults/9eggs, progress[505000,210000], eggElapsed210000, eggProgress546, Seeds20700/Branches1800/Provisions18000; repeated offline target unchanged. Scheduler splits incubation/graduation/income boundaries and settles zero-time transitions, with no fixed loop cutoff omitting catch-up time. Worker additionally tests held full-yard/two-nest/resupply/partial saves/instant Lake incubation. Existing per-slice4dp currency rounding discrepancy<0.01 in partial-save variant disclosed; nursery production state identical.
- Progress moves after nextHabitat.previousIndex card; actual-build/render VM covers legacy order, forward/backward gates, notices/disabled actions/all-unlocked hidden progress. Query caps current Lake reduction300seconds while raw activation remains unchanged; supported0/12/65/330 and unsupported330(30active) compare to real automatic egg duration. Retained working-followup HUD rates now1.375/1.5813/2.6125/paused1.375; direct actual HUD formatting checked, browser coverage preserved/unexecuted.
- Fresh economy round2 delegate_task includes original brief, prior findings plus UI-owned/economy dependency findings, worker response, parent evidence and scheduler boundary/RNG/performance/save/service review focus. Same local codex/gpt-6.1-sol/high creation settings, taskId above. UI aggregate wording/smoke fix is explicitly owned by UI6cb9d3a; no duplication.

### Seed round 2 findings and response

- Reviewer confirms both round1 objections resolved:256case independent buffered ontime/delayed matrix and exact respawn-growth guard reproduction passed. Full355 and targeted50 tests pass; clean frozen candidate,6HTTP assets match.
- New P2: session inputElapsed subtracts wall delay from rescaled/frozen accumulator, misclassifying original tick fraction across speed/pause. 200ms tick/head10,10right/Seed11,10; inputup timestamp1171(85.5%), speedRabbit1175/delivery1180 -> ontime consumesSeed11,10, delayed turns10,9/misses. Slowing also incorrectly defers some84.9% inputs. Pause1175/tick10ms/resume/deliver1171 reproduces same bypass. Parent independently reproduced speed and pause cases.
- Original Seed worker receives complete findings/request-time progress fix/regressions through stable request ID `colony-batch-seed-r2-fixes-20261011`. Both prior fixes/tests retained. Changed tip must receive fresh round3 original brief+all previous findings/resolutions+response review. No Seed tip accepted/merged yet.

### UI round 2 acceptance and bank-supported Lake condition

- UI reviewer PASS owned scope at exact6cb9d3a, clean/no drift. Both UI-owned objections resolved. Independent UI script,35 targeted/check335/syntax/authority/whitespace passed; additional VM verified actual actions/queue/archive/service/control identity/current callback, canonical smoke fixture under both queries and length-scaledSeeds/rawForager. FourHTTP assets match. No further UI-owned fix needed; preserve this exact tip for eventual merge.
- New economy-owned P2: counts[5,330,5,1], Lakeupgrade9, Provisions1e6, eggProgress500 -> habitatPanel bank-supported activation displays-300HatchSec/Egg, but automatic tick1 eggDuration243000ms means actual reduction57sec. Parent independently reproduced. Read-model must derive hatch effect from the same recurring-supported activation as egg creation; UI consumes field. Do not change actual mechanics solely to match display.
- Sent finding to original economy thread requestID `colony-batch-economy-lake-bank-r2-20261011`; its round2 review still running, so worker must keep tracked worktree/tip7f75b34 stable while preparing analysis. Coordinator releases edit freeze with terminal review findings; changed tip then requires fresh review including this condition. HUD rate fixes present but browser unexecuted. No merge until all three pass.

### Seed timing fixes and round 3 evidence

- Seed new clean/pushed candidate `e9818bb723f2e61310c85e3dfb1b631f162a947c`: current-tick normalized progress/interval/running clock segments track speed/pause/resume; direct input and correction lookup original inputAt, movement resets history, replay checkpoints restore segments. Fractional replay uses exact originaldelta prefix/suffix. Timing history ephemeral, durable save/deferred/guards unchanged.
- Four new groups cover52 ontime/delayed pairs84.9/85/85.5%, all6faster/slower presets,pause10/1000ms,late0/16/34ms afterspeed/pause and multi-segment buffered latest/invalidreversal. Prior20 Seed regressions/tongue retained. Parent inspected session+test fixdiff and independently npmcheck359/359+syntax/authority/whitespace passed; worker targeted63/63.
- New round3 delegate_task includes original brief, complete priorR1/R2 findings, resolvedR1 response,newfix response,parent evidence and timing boundary/lifecycle/memory/replay/guard focus. Same localcodex/gpt-6.1-sol/high at creation, taskID above. Await completion before accepting/merging.

### Economy round 2 findings and freeze release

- Reviewer passed351tests/syntax120/authority11,960baseline formula comparisons,original1hour parity/progressionDOM,4bufferedSeed replay/service cases,UIwording,1year/500year catch-up/no-repeat stress and6HTTPassets; clean/no drift. Three uncovered defects remain.
- P2 funded scheduler: thresholds use renewable Provision output but tickHabitats applies bank-funded output. Save1000,Seeds/Branches0,Provisions1e6,counts[5,5,5,300,5,5,5,6000],allupgrades2;1202oneticks vs offline1203000 yields live1adult/4eggs vs offline0/3,Seeddifference3181.286,Provisiondifference157.246. Funded95.58/sec vs scheduler47.4714/sec; firstegg5465.54vs10532.66ms. Parent independently reproduced nursery and resource discrepancy. Fix thresholds to actual output plus bank depletion boundaries; exceeds small rounding caveat.
- P2 Lake read model: query bank-funded330active/capped300sec versus actual renewable30sec egg effect (counts[5,330],upgrade[0,9],bank1e6,eggProgress500,tick1->270000ms). UIfixtureRiver1 yields57sec instead. Worker prepared query eggActivation from same default authoritative calculation, only egg effect field changes, bank-funded production/stats and actual egg mechanics preserved. Test banks0/1e6 xRiver0/1/25 effects30/57/300 and zero/partial/read-no-accrual.
- P3 fractional deadline: counts[5,5,5,11],currencies0,nest/nurserylevel2,twohatchlings0,900one-secondticks produce2adults;single900000ms offline produces0,progress899999.9999999998each, persistsreload thennext1msgraduates. Parent independently reproduced. Snap known consumed timer boundaries, meaningful fractionaldeadline regression.
- Freeze explicitly released with complete findings via requestID `colony-batch-economy-r2-fixes-release-20261011`. Original economy worker owns all3fixes, must retain prior regressions, rerunchecks/pushnewtip/report. Fresh round3 originalbrief+allfindings/responses review required. UI accepted tip remains6cb9d3a; Seed round3 runninge9818bb. No feature merges.

## Review and integration sequence

1. Wait for all three worker completions; end turns while waiting (no polling monitors).
2. Independently inspect each complete diff against baseline and run appropriate checks in that worker checkout. Freeze and record exact reviewed tips; detect subsequent drift.
3. Delegate independent read-only reviews using T3 delegate_task, local provider `codex`, model `gpt-6.1-sol`, reasoningEffort `high` selected at task creation. Include original scoped brief, acceptance, worker evidence and unresolved findings. Record every taskId. New rounds use fresh delegate_task and distinct stable clientRequestId. Send fixes to original implementation thread, then re-review changed tips.
4. Only after each passes, merge all three exact reviewed tips here with merge commits. Resolve conflicts preserving the full batch. Re-run npm run check and cross-feature regressions.
5. Push this branch and create one preferably draft PR to working. Preserve existing CI triggers/tests/exceptions; confirm drafts run CI. Body describes all nine conditions, review commits/task evidence, tests, preview, compatibility and visual gaps.
6. Immediately link PR to integration and home using link_pull_request; before finishing list_thread_pull_requests and repair missing links. Report tool failures honestly.
7. Send home the PR, commits, review evidence, CI state, preview and concerns with mode auto/request ID above. Instruct home to use watch_pull_request; home owns babysitting and notifying William when review-ready. Do not create own watcher.

## Preview and verification record

- Existing shared server: PID 10940, port 4173; launcher `C:/Code/IdleSnake/.git/shared-test-server.cjs`, dynamic routes `C:/Code/IdleSnake/.git/local-test-routes.json`. Coordinator is sole route editor; do not restart server.
- Existing `/test1/` remains approved tongue checkout. Reserve `/test2/` Seed, `/test3/` UI, `/test4/` economy, `/test5/` integration; primary `/` remains root working.
- App HTML scripts/styles/images use relative assets, compatible with trailing-slash route base. Verify actual HTTP bytes and checkout identity for each route.
- Baseline `npm run check`: passed syntax, authority and all 335 Node tests (0 skipped). No browser tests run locally.
- Initial direct HTTP verification: 10 assets per route matched exact mapped checkout (HTML, game/CSS, session/queries, approved tongue engine/draw, theme kit/official CSS and image); primary game.js matches root working. Recheck after workers finish and integration merges.
- Root preservation baseline: SHA-256 hashes for 27 unrelated modified/untracked root files saved locally in this worktree's git directory as `batch-root-preservation.json` (not committed).
- All visual smoothness/layout/theme fit/accessibility by eye remain unverified until William tests. Direct engine/VM/HTTP checks cannot prove them.
- PR: not created. UI owned scope accepted at6cb9d3a; economy round2 fixes underway; Seed round3 running ate9818bb. No feature branch integrated yet.
