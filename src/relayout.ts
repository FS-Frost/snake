import Phaser from "phaser";
import { applyLayout, canvasSize, HEIGHT, SCENES, WIDTH } from "./config";
import type { GameOverScene } from "./scenes/GameOverScene";
import type { GameScene } from "./scenes/GameScene";

const DEBOUNCE_MS = 250;
/** While the death animation runs the match cannot be snapshotted; retry after it settles. */
const RETRY_MS = 400;

let timer: number | undefined;

function isOn(game: Phaser.Game, key: string): boolean {
    return game.scene.isActive(key) || game.scene.isPaused(key);
}

/**
 * Recomputes the layout for the current viewport and, if it changed, resizes the canvas and
 * rebuilds the visible scenes. A running match is carried over and lands on the pause menu.
 */
export function relayout(game: Phaser.Game, force = false): void {
    const changed = applyLayout();
    if (!changed && !force) {
        return;
    }

    const gameScene = game.scene.getScene(SCENES.game) as GameScene;

    if (isOn(game, SCENES.game)) {
        const state = gameScene.getResumeState();
        if (!state) {
            window.setTimeout(() => relayout(game, true), RETRY_MS);
            return;
        }

        resizeCanvas(game);
        const gameOver = game.scene.getScene(SCENES.gameOver) as GameOverScene;
        const results = isOn(game, SCENES.gameOver) ? gameOver.lastData : null;

        for (const key of [SCENES.pause, SCENES.settings, SCENES.gameOver]) {
            game.scene.stop(key);
        }
        game.scene.start(SCENES.game, { ...gameScene.getSettings(), resume: state });

        if (results) {
            game.scene.run(SCENES.gameOver, results);
            game.scene.pause(SCENES.game);
        }
        return;
    }

    resizeCanvas(game);

    if (isOn(game, SCENES.menu)) {
        game.scene.stop(SCENES.settings);
        game.scene.start(SCENES.menu);
    }
}

function resizeCanvas(game: Phaser.Game): void {
    const { width, height } = canvasSize();
    game.scale.setGameSize(width, height);
}

/**
 * Every scene works in logical coordinates (WIDTH x HEIGHT); its main camera zooms them up to the
 * high-resolution canvas. Applied after each scene's create().
 */
export function fitCamerasToLogicalSize(game: Phaser.Game): void {
    for (const scene of game.scene.scenes) {
        scene.events.on(Phaser.Scenes.Events.CREATE, () => {
            const camera = scene.cameras.main;
            camera.setZoom(game.scale.width / WIDTH, game.scale.height / HEIGHT);
            camera.centerOn(WIDTH / 2, HEIGHT / 2);
        });
    }
}

/** Rotation and window resizes trigger a debounced relayout. */
export function watchLayout(game: Phaser.Game): void {
    const schedule = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => relayout(game), DEBOUNCE_MS);
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
}
