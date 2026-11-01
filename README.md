# Snake: Neon Grid

🐍 A neon synthwave (or pixel Old School) take on Snake, built to feel like a game, not a web page: everything happens inside the canvas, with procedural music and sound, and it plays offline once installed.

## Play online

https://fs-frost.github.io/snake/

Install it with **INSTALL APP** in the main menu (Android, desktop Chrome/Edge) or Safari's *Share > Add to Home Screen* on iPhone, to play offline and fullscreen.

## Features

- **Two modes:** Wrap (go through the edges) and Classic (walls kill). Three difficulties, each with its own high score.
- **Power-ups**, one every 5–8 foods, gone after 7 s:
  - **Gold:** x5 points.
  - **Slow-mo:** slower game for 5 s.
  - **Ghost:** pass through your own body for 5 s.
  - **Scissors:** cut a third of your tail.
- **Combo:** eat again within 3 s to raise the multiplier up to x5.
- **Levels:** every 10 foods new obstacles appear, never right in front of you.
- **Procedural audio:** synthwave soundtrack that speeds up with the game, plus synthesized sound effects. No audio files.
- **Two looks:** Neon (synthwave, glow, smooth movement) or Old School in three palettes (Game Boy, Nokia, 8-bit console) with pixel art, cell-by-cell movement and chiptune audio. Purely visual: rules and scores are the same.
- **Surprise me** (default style): every few foods the game jumps to another look mid-match with a TV channel-change effect.
- **Settings:** music/SFX volume, glow, screen shake, flashes (off by default with *reduce motion*), touch controls, style, language (English/Spanish).
- **Touch:** on-screen D-pad (right by default; left or center in settings) or swipe anywhere. Portrait phones get a control strip below the board; landscape puts the HUD and the D-pad in columns beside it, and rotating mid-game keeps the match.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrows / WASD | Swipe or D-pad |
| Pause | Esc / P | II button |
| Menus | Arrows + Enter, Esc to go back | Tap (left/right half of an option to change it) |

## Built with

- [Phaser 4](https://phaser.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Bun](https://bun.sh/)

## Development

```shell
git clone https://github.com/FS-Frost/snake
cd snake
bun install
bun run dev      # http://localhost:5000
bun test         # game rules unit tests
bun run build    # typecheck + production build in dist/
```

Pushing to `master` runs the tests, builds and deploys to GitHub Pages through GitHub Actions (`.github/workflows/deploy.yml`).

See [CLAUDE.md](CLAUDE.md) for the architecture and conventions.
