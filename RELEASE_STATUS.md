# Snake Forever release 1.0.4

William authorized release of the current committed working version on 2026-10-11.

- Code baseline: `31e773efee60c85d6781078803e4eae208911e4e`.
- Previous main: `9d83dd25e2c066fa8231e5efa825755a0513f077` (1.0.3).
- Release-only files: package.json, package-lock.json, BRANCHES.md and RELEASE_STATUS.md.
- Included: the approved tongue Seed return and the committed theme, Notables and fullscreen changes.
- Excluded: Colony and Minigame batches, other worker branches, archived tongue catch, and root unfinished balance files.
- Target: merge commit on `main`; Pages source is `main` at `/`, https://wehinson.github.io/IdleSnake/.

Local verification passed: `npm run check` (syntax, engine authority and 335 Node tests), 20 focused direct engine/drawing tests, deterministic headless Snake smoke command and `git diff --check`. Local browser automation and computer use were not authorized or performed. Existing GitHub CI runs its browser tests without changes to the workflow.

Release code is shipped and verified. Integration commit `0f148ad1af6b6d288cb67d956f3d9a6e851fa003` has parents `9d83dd25e2c066fa8231e5efa825755a0513f077` (previous main) and `4a3e41413f23be3fbe1bb79e0673a47abf4c8c2d` (release metadata on the approved baseline). Local main, origin/main and the remote main ref matched this integration commit.

- [Main CI run 38119224810](https://github.com/wehinson/IdleSnake/actions/runs/38119224810): success; syntax and authority checks, 335 Node tests and all 89 existing browser tests passed.
- [Pages run 38119224754](https://github.com/wehinson/IdleSnake/actions/runs/38119224754): success. Pages build API reports `built` from the integration commit. Deployment 6992096324 reports `success`, source SHA equal to the integration commit, environment https://wehinson.github.io/IdleSnake/.
- Live HTTP verification at 2026-10-11 06:50 UTC: package version 1.0.4; all 66 checked files match committed bytes by SHA-256, using ordinary and cache-busted URLs. Includes index.html, every main-page script/style/image, all engine runtime modules, theme assets, audio and package files.
- Scope proof: main differs from the approved baseline only in the four release files listed above. Latest observed Colony `69e18ce7569f3deddadeeb2734ec850c9e21c3f5` and Minigame `1a01bf65e1d113cc8df0ae3af08b6c7ab512c75f` tips were not ancestors of main. Both batches continue independently; their tips can advance after this observation.

This completed verification record is a documentation-only followup to the verified integration. Runtime code and version remain unchanged. Final handoff checks must confirm the resulting local/remote main commit, its own CI/Pages deployment source and live runtime bytes. Exact final refs and any incomplete step are sent automatically to the home thread. No release PR is required because main is unprotected and direct integration was authorized.

Backup tags `backup/main-before-1.0.4-20261011` and `backup/working-before-1.0.4-20261011` preserve the previous main and approved baseline on origin.

The root checkout remains on `working` at the approved baseline, with its uncommitted `.github/workflows/ci.yml`, README.md, package.json, balance workflow/brief/script and simulation/ preserved. All 27 original modified/untracked file hashes matched the pre-release snapshot. Root remains dirty by explicit instruction; release checkout is separate and clean after commits. Keep `working`, all active bindings/worktrees and shared preview routes. PID 10940 was not restarted and `/test1` through `/test12` remain mapped. No branches or worktrees were removed because active bindings and pending work must be preserved. Colony and Minigame remain two independent review PRs targeting `working`; neither is authorized for release. Future authorized base integration must account for release metadata without a batch-specific version bump. Both coordinators were notified of release version, ancestry and this restriction. UI appearance was not checked locally; the existing CI browser tests passed.
