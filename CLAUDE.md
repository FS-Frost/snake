# CLAUDE.md

Snake game, neon/synthwave style, built to feel like a native game (no DOM UI, no `alert`).

## Stack

- Phaser 4 (WebGL, Canvas fallback) + TypeScript (strict) + Vite.
- Package manager: bun (`bun.lock`). Tests: `bun test`.
- Phaser 4 API docs ship inside the package: `node_modules/phaser/skills/<topic>/SKILL.md`. Phaser 4 differs from 3 (Filters replace preFX/postFX, no Bloom filter: use `Phaser.Actions.AddEffectBloom`). Check there before writing Phaser code.

## Commands

- `bun run dev`: dev server on http://localhost:5000. Exposes `window.game` (dev only) for debugging.
- `bun run build`: typecheck + build to `dist/`.
- `bun run typecheck`, `bun test`.

## Architecture

- `src/core/`: pure game rules, no Phaser imports. `SnakeGame` advances one tick per `step()`; buffers turns (`queueTurn`); food spawns from the list of free cells. Unit tested in `tests/`.
- `src/scenes/`: `Boot` (procedural textures) → `Menu` → `Game`. `Pause`, `GameOver` and `Settings` are overlay scenes launched on top of a paused caller.
- `src/audio/Audio.ts`: singleton `audio`. All music and SFX synthesized with Web Audio (no files). Unlocked by the first input on the "press any key" title (browser autoplay rules). Music sections: `menu`, `game` (tempo follows intensity), `off`; muffled with a lowpass while paused.
- `src/ui/TouchControls.ts`: swipe (always on touch devices) + optional D-pad.
- `GameScene` runs a fixed timestep (accumulator) decoupled from render FPS and interpolates head/tail between ticks.
- `src/ui/`: `neonText` (glow text), `applyNeonPost` (camera bloom), `MenuList` (keyboard/mouse/touch menu), `Background`, overlay helpers.
- `src/i18n.ts`: every user-visible string goes through `t()`; keep `en` and `es` in sync.
- `src/storage.ts`: localStorage wrapped in try/catch; the game must run without storage. Holds high scores and `Settings` (volumes, bloom/shake/flash toggles, touch scheme, language). Shake/flash default off under `prefers-reduced-motion`.
- Use `shake`, `flash`, `vibrate` from `src/ui/neon.ts`, never the camera methods directly, so settings are respected.
- No image/audio files: textures are generated in code.

## Conventions

- 4-space indent, double quotes, Prettier.
- Logical resolution 720x860 (`src/config.ts`), scaled with `Scale.FIT`. Position everything in logical coordinates. On portrait touch devices (`TOUCH_LAYOUT`) the height grows to the screen aspect (1100-1600) and the strip below the board holds touch controls; position by `HEIGHT`/`CONTROLS_Y`, not hardcoded 860.
- Colors and layout constants live in `src/config.ts`; do not hardcode them in scenes.
- Overlays cannot fade the paused `Game` camera; use `exitOverlay` in `src/ui/overlay.ts`.
- Headless browser checks: software WebGL (swiftshader) runs ~20 FPS and makes frames lag behind input. Use the real GPU (`--use-angle=d3d11`) to judge visuals or timing. Leave ~40 ms between synthetic key presses: Phaser drops events with identical keyCode and timeStamp.
- Port 5173 is often taken by another local project; use another port for checks.

## Roadmap (branch `feat/phaser-rewrite`)

1. Done: Vite + Phaser core, scenes, HUD, modes (wrap/classic), 3 difficulties, high scores.
2. Done: procedural Web Audio (SFX + music), settings menu (volume, effects toggles, reduced motion, language, touch D-pad), swipe controls.
3. Power-ups: golden food, slow-mo, combo multiplier, ghost, scissors, obstacles per level.
4. PWA with offline cache (`vite-plugin-pwa`), GitHub Actions deploy to Pages, remove committed `docs/`.
