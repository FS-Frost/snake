import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/orbitron/latin-900.css";
import "@fontsource/press-start-2p/latin-400.css";
import "./style.css";
import Phaser from "phaser";
import { canvasSize, COLORS } from "./config";
import { DEBUG, installDebugOverlay, reportRenderer } from "./debug";
import { captureInstallPrompt } from "./install";
import { fitCamerasToLogicalSize, watchLayout } from "./relayout";
import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { PauseScene } from "./scenes/PauseScene";
import { MessageScene } from "./scenes/MessageScene";
import { SettingsScene } from "./scenes/SettingsScene";

async function loadFonts(): Promise<void> {
    // Phaser rasterizes text to canvas once; drawing before the font is ready bakes in the fallback.
    try {
        await Promise.all([
            ...[400, 500, 700, 900].map((weight) => document.fonts.load(`${weight} 32px Orbitron`)),
            document.fonts.load("16px 'Press Start 2P'"),
        ]);
    } catch {
        // Fallback fonts are acceptable.
    }
}

installDebugOverlay();
// Before awaiting anything: the browser may fire the install prompt event right away.
captureInstallPrompt();
await loadFonts();

const game = new Phaser.Game({
    type: DEBUG.forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
    parent: "game",
    width: canvasSize().width,
    height: canvasSize().height,
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
    scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene, SettingsScene, MessageScene],
});

game.events.once(Phaser.Core.Events.READY, () => {
    // Scenes exist only once the game is ready.
    fitCamerasToLogicalSize(game);
    reportRenderer(game);
});
watchLayout(game);

if (import.meta.env.DEV) {
    // Handle for debugging and automated checks from the browser console.
    (window as unknown as { game: Phaser.Game }).game = game;
}
