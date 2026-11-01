# CLAUDE.md

Snake game built to feel like a native game (no DOM UI, no `alert`). Two looks: Neon (synthwave) and Old School (Game Boy, Nokia, 8-bit console pixel palettes).

## Stack

- Phaser 4 (WebGL, Canvas fallback) + TypeScript (strict) + Vite.
- Package manager: bun (`bun.lock`). Tests: `bun test`.
- Phaser 4 API docs ship inside the package: `node_modules/phaser/skills/<topic>/SKILL.md`. Phaser 4 differs from 3 (Filters replace preFX/postFX, no Bloom filter: use `Phaser.Actions.AddEffectBloom`). Check there before writing Phaser code.

## Commands

- `bun run dev`: dev server on http://localhost:5000. Exposes `window.game` (dev only) for debugging.
- `bun run build`: typecheck + build to `dist/` (includes the PWA service worker and manifest from `vite-plugin-pwa`, configured in `vite.config.ts`).
- `bun run typecheck`, `bun test`.

## Architecture

- `src/core/`: pure game rules, no Phaser imports. `SnakeGame` advances one tick per `step()` and its timers (item expiry, effects, combo window) with `advance(ms)`, called only while playing so pause freezes them. Buffers turns (`queueTurn`); food, items and obstacles spawn from the list of free cells. Tunables in `RULES`. Unit tested in `tests/`.
- `src/scenes/GameViews.ts`: all board drawing used by `GameScene` (`drawBoard`, `SnakeView`, `FoodView`, `ItemView`, `ObstacleView`, `PowerHud`). Each view branches on `theme().pixel`: neon shapes vs 8x8 pixel sprites (`SPRITES`).
- `src/theme.ts`: visual styles (`neon`, `gameboy`, `nokia`, `console`). Scenes ask `theme()` for colors by role (`text.primary`, `food`, `items.golden`...) and never use `COLORS`/`CSS` from `config.ts` directly, except inside neon-only branches. Pixel styles: Press Start 2P font, no glow/bloom, cell-by-cell movement, chiptune audio (`audio.setChiptune`), accents stripped by `t()` (the font squeezes accented capitals).
- Style and language rebuild every screen, so they can only be changed from the main menu's settings (`fromMenu`); changing style restarts the Settings scene as a live preview.
- `src/scenes/`: `Boot` (procedural textures) → `Menu` → `Game`. `Pause`, `GameOver` and `Settings` are overlay scenes launched on top of a paused caller.
- `src/audio/Audio.ts`: singleton `audio`. All music and SFX synthesized with Web Audio (no files). Unlocked by the first input on the "press any key" title (browser autoplay rules). Music sections: `menu`, `game` (tempo follows intensity), `off`; muffled with a lowpass while paused.
- Music: songs are data + a per-step arrangement in `src/audio/songs.ts` (`title`, `grid`, `overdrive`, `surf`; 4 bars x 16 steps). The engine passes synth `Voices` that already apply the timbre (synthwave, or chiptune when `setChiptune`/`setTimbreOverride`). In game, `gameSong(level)` (`src/tracks.ts`) picks Overdrive from level 5, Surf in Surprise mode, otherwise Grid. Adding a song: add it to `SONGS`, a `TRACKS` entry and `track.*`/`lock.*` i18n keys.
- Fonoteca (`FonotecaScene`, from the main menu): tracks = song + timbre; title tracks are free, the rest unlock by playing (`unlockEarned`, stored in `unlockedTracks`) and are announced in game. Continuous play uses `audio.onLoop`; the visualizer reads `audio.getSpectrum` (AnalyserNode after the music volume). Closing resets intensity, timbre override and returns to the title song.
- `src/ui/TouchControls.ts`: swipe (always on touch devices) + optional D-pad.
- `GameScene` runs a fixed timestep (accumulator) decoupled from render FPS and interpolates head/tail between ticks.
- `src/ui/`: `gameText` (text in the active style; colors are `TextRole`s), `applyNeonPost` (camera bloom), `MenuList` (keyboard/mouse/touch menu), `Background`, overlay helpers.
- `src/i18n.ts`: every user-visible string goes through `t()`; keep `en` and `es` in sync.
- `src/install.ts`: PWA install offer. `beforeinstallprompt` is captured in `main.ts` before anything is awaited; iOS gets manual steps (`MessageScene`). Nothing is offered when running standalone.
- First launch shows a style chooser (live preview) until `styleChosen`; afterwards STYLE is a main-menu item.
- Style setting `surprise` (default): `theme()` resolves to a random concrete style (`activeStyle()`); every 3-6 foods `surpriseOnFood()` picks another and `GameScene` restarts itself with `resume.styleSwitch` (match kept, TV channel-change effect, no pause).
- `src/storage.ts`: localStorage wrapped in try/catch; the game must run without storage. Holds high scores and `Settings` (volumes, bloom/shake/flash toggles, touch scheme, language). Shake/flash default off under `prefers-reduced-motion`.
- Use `shake`, `flash`, `vibrate` from `src/ui/neon.ts`, never the camera methods directly, so settings are respected.
- Bloom (Phaser 4 filters) renders black on some Android GPUs. `BootScene` probes it once per launch (gray square below the bloom threshold, `readPixels` at the canvas center) whatever the starting style (`isBloomSupported`); `isBloomAvailable` adds the style check. The Glow setting shows N/A where unsupported. Always add bloom through `applyNeonPost`/`addBloom`. The probe relies on Boot's camera being fitted too: `fitCamerasToLogicalSize` also fits scenes already active at READY.
- Diagnostics: `?debug=1` (DOM report: GPU, GL, probe result, fps, scenes), `?bloom=0`, `?renderer=canvas` (`src/debug.ts`).
- No image/audio files: textures are generated in code.

## Conventions

- 4-space indent, double quotes, Prettier.
- Layout (`src/config.ts`): `LAYOUT` is `desktop` (720x860), `portrait` (touch upright: 720 x screen aspect, controls strip below the board) or `landscape` (touch sideways: 760 tall, board centered, HUD column at `HUD_X`, controls column at `CONTROLS_X` on the D-pad side). Values are `export let` live bindings recomputed by `applyLayout()`; always read `WIDTH`/`HEIGHT`/`BOARD_X`... at scene create, never cache them at module load.
- Sharpness: the canvas renders at physical resolution (`RENDER_SCALE` = CSS fit scale x devicePixelRatio, 0.5-3) and `fitCamerasToLogicalSize` zooms every scene's main camera, so scenes keep using logical coordinates. Texts rasterize at `RENDER_SCALE`. Raw `pointer.x/y` are canvas pixels: divide by `RENDER_SCALE` (or use the camera) for logical distances.
- `src/relayout.ts`: on resize/rotation, recomputes the layout, resizes the canvas and restarts visible scenes. A running match is passed to `GameScene` as `resume` and lands on the pause menu.
- `gameText` enforces a minimum on-screen size (12 CSS px neon, 10 pixel), so small labels grow on phones: give HUD texts room (centered columns), never tight fixed offsets.
- Colors and layout constants live in `src/config.ts`; do not hardcode them in scenes.
- Overlays cannot fade the paused `Game` camera; use `exitOverlay` in `src/ui/overlay.ts`.
- Headless browser checks: software WebGL (swiftshader) runs ~20 FPS and makes frames lag behind input. Use the real GPU (`--use-angle=d3d11`) to judge visuals or timing. Leave ~40 ms between synthetic key presses: Phaser drops events with identical keyCode and timeStamp.
- Port 5173 is often taken by another local project; use another port for checks.

## Roadmap

1. Done: Vite + Phaser core, scenes, HUD, modes (wrap/classic), 3 difficulties, high scores.
2. Done: procedural Web Audio (SFX + music), settings menu (volume, effects toggles, reduced motion, language, touch D-pad), swipe controls.
3. Done: power-ups (golden x5, slow-mo 5 s, ghost 5 s, scissors cut 1/3), item every 5-8 foods lasting 7 s, combo up to x5 within 3 s, obstacles every 10 foods (level).
4. Done: PWA with offline precache (`vite-plugin-pwa`, auto update), GitHub Actions deploy to Pages (`.github/workflows/deploy.yml`; PRs only build and test), committed `docs/` removed.

## Deploy

- Pages source is "GitHub Actions". Pushing to `master` tests, builds and publishes `dist/`. Never commit build output.
- Work directly on `master` (no feature branches or PRs). Run `bun test`, `bun run build` and a browser check before pushing, since the push deploys immediately.
