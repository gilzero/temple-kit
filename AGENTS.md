# AGENTS.md

Guidance for coding agents working on `@gilzero/temple-kit`.

## Purpose

Shared, game-agnostic foundation modules for the temple-walk games in `/Users/apple/gilzero.dev/` (`kaiyuan`, `jing-an`, and later `xichan`).
The games install the kit from GitHub (`git+ssh://git@github.com/gilzero/temple-kit.git#vX.Y.Z`; Bun fetches `github:` specs through the API tarball endpoint, which 404s for private repos). This is not a monorepo. Never add workspace links between repos.

## Rules

- Bun only. Never use npm, pnpm or yarn.
- Ship TypeScript source from `src/`. Do not add a build step unless a consumer cannot compile the source.
- Add one `exports` entry per module in `package.json`, so a game imports `@gilzero/temple-kit/<module>` and Vite tree-shakes the rest.
- `three` stays a peer dependency (`^0.180.0`). Keep it in `devDependencies` only for local tests.
- Never import game code (`../world`, `../log`, `./media`, palettes). Take game data, loggers and storage as arguments or factory options.
- Express drift between games as small options whose default reproduces an existing game exactly. If a difference is a different algorithm or art direction, leave the module in the game.
- Keep `sideEffects: false` true. Modules must not do work at import time beyond constant tables.

## Code style

- Every source file starts with `// @file: <name>` and `// @desc: <six words or fewer>`.
- Strict TypeScript with `noUncheckedIndexedAccess` and `noImplicitReturns`. No `any`. Use `import type` for types.
- Never swallow errors. A recoverable failure is reported through the injected `TempleLogger`.
- Prettier defaults and `typescript-eslint` recommended rules.

## Telemetry

- `perf-*` modules must never send user ids, IPs, full agent strings or locations. Change the batch shape only by bumping `perfSchemaVersion`, and keep the intake strict (exact keys, enums, ranges, 2 KB cap).

## Checks

- `bun run qc` formats, lints, type-checks and runs `bun test`.
- `bun run qc:ci` is the read-only variant that CI runs.
- Put tests for pure logic in `tests/*.test.ts`. Browser globals are replaced with `tests/browser-storage.ts` helpers.

## Releasing a version

1. Run `bun run qc`.
2. Bump `version` in `package.json` (patch unless told otherwise).
3. Commit, tag `vX.Y.Z`, and push both the branch and the tag.
4. In each game run `bun add "git+ssh://git@github.com/gilzero/temple-kit.git#vX.Y.Z"`, then that game's `bun run qc`, `bun run smoke` and (Jing'an) `bun visual`.

## Adopting a module from a game

1. Diff the module across the games. Only move it if the copies are identical or differ by a small option.
2. Copy it into `src/`, replace game imports with parameters, and add an `exports` entry.
3. In each game, delete the local copy and import from the kit. Keep a thin local binding only when a factory needs game state.
4. Confirm the game's bundle size does not grow.

## Consumers

| Game    | Local bindings kept                                 |
| :------ | :-------------------------------------------------- |
| kaiyuan | `storage.ts`, `scene-recovery.ts`, `seal-memory.ts` |
| jing-an | `storage.ts`, `scene-recovery.ts`, `seal-memory.ts` |
| xichan  | `perf.ts`                                           |
| polin   | `perf.ts` (perf telemetry only)                     |
| zen     | `perf.ts` (perf telemetry only)                     |
