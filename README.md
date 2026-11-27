# temple-kit

Shared foundation modules for the temple-walk browser games (Kaiyuan, Jing'an, and later Xichan).
Each game installs the kit as an ordinary dependency. There is no monorepo.

The kit ships TypeScript source. Vite and Bun compile it in the consuming game, so there is no build step.
`three` is a peer dependency (`^0.180.0`). The game supplies it.

## Install

```sh
bun add github:gilzero/temple-kit#v0.1.0
```

Import one module per path. Every module has its own `exports` entry so Vite only bundles what a game uses:

```ts
import { giwaRoof } from "@gilzero/temple-kit/giwa-roof";
import { createPreferenceStore } from "@gilzero/temple-kit/storage";
```

## Modules

| Module              | Purpose                                     |
| :------------------ | :------------------------------------------ |
| `altar-offerings`   | shape celadon vases and chrysanthemums      |
| `building-tools`    | share architectural rendering primitives    |
| `carved-grid`       | join rows of sculpted vertices              |
| `chanting`          | stream devotional chanting between silences |
| `floor-cushion`     | shape woven temple floor cushions           |
| `giwa-roof`         | lay hipped clay tile roofs                  |
| `guanyin-carving`   | sculpt Guanyin robes and attributes         |
| `guanyin-face`      | carve downcast eyes and features            |
| `hall-hangings`     | suspend brocade lotus temple hangings       |
| `logger`            | injectable sink for recoverable failures    |
| `maple-foliage`     | light painted leaves in wind                |
| `movement-wheel`    | track directional thumb movement            |
| `novice-shadows`    | ground the novice during practice           |
| `orbit`             | orbit and zoom around walkers               |
| `path-lantern`      | illuminate carved granite path lanterns     |
| `practice`          | time greetings and cushion practice         |
| `prayer-strand`     | paint wooden prayer beads                   |
| `ridge-carving`     | curve pierced ceramic ridge scrolls         |
| `roof-glaze`        | shade overlapping clay roof tiles           |
| `scene-recovery`    | recover visits after scene failures         |
| `seal-memory`       | keep seals across open tabs                 |
| `sparrow-calls`     | time perched sparrow contact calls          |
| `stone-strip`       | join stone courses through bends            |
| `storage`           | retain preferences across temple visits     |
| `timber-bench`      | shape carved village timber benches         |
| `tree-sparrow`      | model articulated tree sparrow plumage      |
| `walking-obstacles` | index static temple walking obstacles       |
| `weathered-plaster` | stain limewash beneath temple eaves         |

## Options instead of forks

Where the games had drifted slightly, the difference is an option and the default matches the original copy:

- `bindOrbit(canvas, tap, { minPitch })` sets the lowest camera pitch. The default is `0.08`. Kaiyuan passes `-0.45`.
- `guanyinFace(detailed, finish, { urna })` and `figureDetails(detailed, headOnly, { urna })` carve Jing'an's brow urna.
- `noviceShadows(root, { programCacheKey })` shares one compiled shader program.
- `limewashMatcher(extra)` adds a temple's own limewash colours. `isLimewash` is the base palette.
- `pathLanternStone("grove")` builds the grove variant. The default is `"walkway"`.
- `PrayerStrand.draw(position, sway)` trails the silk. `sway` defaults to `0`.
- `new Chanting(ctx, bus, unavailable, source)` takes the published audio URL.

## Injected game state

The kit never imports game code. Modules that log or read game data take it as arguments:

- `logger.ts` defines `TempleLogger`, a single `warn(msg, context)` method. Each game passes its own structured `log`.
- `createPreferenceStore({ prefix, logger })` returns `read`, `write`, `remove`, `readCount`, `incrementCount` and `storageKey`.
- `createSceneRecovery({ session, logger })` returns `publishedBuild`, `reloadWalk`, `takeResume` and `sceneLoaded`.
- `createSealMemory({ read, write, isLandmark })` returns `savedSeals`, `recordSeal` and `syncSeals`.

Each game keeps a thin local binding (for example `src/foundation/storage.ts`) that calls these factories once.

## Quality checks

```sh
bun install
bun run qc      # prettier --write, eslint --fix, tsc, bun test
bun run qc:ci   # the same checks without writing files
```

CI runs `bun run qc:ci` on pushes, tags and pull requests.

## Releasing

1. Change the kit and run `bun run qc`.
2. Bump `version` in `package.json`, commit, and tag `vX.Y.Z`.
3. Push the commit and tag. Then run `bun add github:gilzero/temple-kit#vX.Y.Z` in each game.

## Private access

The repository is private. Each game's CI and its Cloudflare Workers Builds need a read-only token to install it.
The game READMEs describe the `TEMPLE_KIT_TOKEN` setup.
