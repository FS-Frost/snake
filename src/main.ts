import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/orbitron/latin-900.css";
import "./style.css";
import Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH } from "./config";
import { DEBUG, installDebugOverlay, reportRenderer } from "./debug";
import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { PauseScene } from "./scenes/PauseScene";
import { SettingsScene } from "./scenes/SettingsScene";

async function loadFonts(): Promise<void> {
    // Phaser rasterizes text to canvas once; drawing before the font is ready bakes in the fallback.
    try {
        await Promise.all([400, 500, 700, 900].map((weight) => document.fonts.load(`${weight} 32px Orbitron`)));
    } catch {
        // Fallback fonts are acceptable.
    }
}

installDebugOverlay();
await loadFonts();

const game = new Phaser.Game({
    type: DEBUG.forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
    parent: "game",
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: COLORS.bgTop,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
        antialias: true,
        powerPreference: "high-performance",
    },
    input: {
        activePointers: 2,
    },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene, SettingsScene],
});

game.events.once(Phaser.Core.Events.READY, () => reportRenderer(game));

if (import.meta.env.DEV) {
    // Handle for debugging and automated checks from the browser console.
    (window as unknown as { game: Phaser.Game }).game = game;
}
