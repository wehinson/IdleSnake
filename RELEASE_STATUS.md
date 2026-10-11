# Snake Forever release 1.0.4

William authorized release of the current committed working version on 2026-10-11.

- Code baseline: `31e773efee60c85d6781078803e4eae208911e4e`.
- Previous main: `9d83dd25e2c066fa8231e5efa825755a0513f077` (1.0.3).
- Release-only files: package.json, package-lock.json, BRANCHES.md and RELEASE_STATUS.md.
- Included: the approved tongue Seed return and the committed theme, Notables and fullscreen changes.
- Excluded: Colony and Minigame batches, other worker branches, archived tongue catch, and root unfinished balance files.
- Target: merge commit on `main`; Pages source is `main` at `/`, https://wehinson.github.io/IdleSnake/.

Local verification passed: `npm run check` (syntax, engine authority and 335 Node tests), 20 focused direct engine/drawing tests, deterministic headless Snake smoke command and `git diff --check`. Local browser automation and computer use were not authorized or performed. Existing GitHub CI runs its browser tests without changes to the workflow.

Main integration, CI, Pages deployment and live HTTP verification are in progress. A completed release requires local main and origin/main to match, a successful Pages deployment sourced from that commit, and live package version and asset bytes matching that commit.

Backup tags `backup/main-before-1.0.4-20261011` and `backup/working-before-1.0.4-20261011` preserve the previous main and approved baseline on origin.

The root checkout remains on `working`, with its uncommitted `.github/workflows/ci.yml`, README.md, package.json, balance workflow/brief/script and simulation/ preserved. The release checkout is separate. Keep `working`, all active bindings/worktrees and shared preview routes. Colony and Minigame remain two independent review PRs targeting `working`; neither is authorized for release. Future authorized base integration must account for release metadata without a batch-specific version bump.
