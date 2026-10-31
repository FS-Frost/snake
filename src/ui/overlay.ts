import Phaser from "phaser";
import { HEIGHT, SCENES, WIDTH } from "../config";

/** Dims the frozen game underneath and swallows pointer input. */
export function createBackdrop(scene: Phaser.Scene, alpha = 0.72): Phaser.GameObjects.Rectangle {
    const backdrop = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05040f, alpha).setOrigin(0).setInteractive();
    backdrop.setAlpha(0);
    scene.tweens.add({ targets: backdrop, alpha: 1, duration: 200 });
    return backdrop;
}

/**
 * Leaves an overlay for another scene. The paused Game scene cannot run its own camera fade,
 * so the overlay paints black on top, then stops the game and starts the target.
 */
export function exitOverlay(scene: Phaser.Scene, key: string, data?: object): void {
    const curtain = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 1).setOrigin(0).setAlpha(0).setDepth(1000);
    scene.tweens.add({
        targets: curtain,
        alpha: 1,
        duration: 220,
        onComplete: () => {
            scene.scene.stop(SCENES.game);
            scene.scene.start(key, data);
        },
    });
}
