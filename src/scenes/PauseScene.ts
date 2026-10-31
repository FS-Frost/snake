import Phaser from "phaser";
import { CSS, HEIGHT, SCENES, WIDTH } from "../config";
import { t } from "../i18n";
import { MenuList } from "../ui/MenuList";
import { applyNeonPost, neonText } from "../ui/neon";
import { createBackdrop, exitOverlay } from "../ui/overlay";
import type { GameSettings } from "./MenuScene";

export class PauseScene extends Phaser.Scene {
    constructor() {
        super(SCENES.pause);
    }

    create(settings: GameSettings): void {
        createBackdrop(this);

        const title = neonText(this, WIDTH / 2, HEIGHT * 0.34, t("paused"), {
            size: 72,
            weight: 900,
            color: CSS.cyan,
            glow: 24,
        });
        this.tweens.add({ targets: title, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });

        const menu = new MenuList(this, WIDTH / 2, HEIGHT * 0.52, [
            { label: () => t("resume"), onSelect: () => this.resume() },
            {
                label: () => t("restart"),
                onSelect: () => {
                    menu.setEnabled(false);
                    exitOverlay(this, SCENES.game, settings);
                },
            },
            {
                label: () => t("mainMenu"),
                onSelect: () => {
                    menu.setEnabled(false);
                    exitOverlay(this, SCENES.menu);
                },
            },
        ]);

        // Short grace period so the same key press that paused does not instantly resume.
        this.time.delayedCall(150, () => {
            this.input.keyboard?.on("keydown-ESC", () => this.resume());
            this.input.keyboard?.on("keydown-P", () => this.resume());
        });

        applyNeonPost(this);
    }

    private resume(): void {
        this.scene.resume(SCENES.game);
        this.scene.stop();
    }
}
