import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { CSS, HEIGHT, SCENES, WIDTH } from "../config";
import { t } from "../i18n";
import { MenuList } from "../ui/MenuList";
import { applyNeonPost, neonText } from "../ui/neon";
import { createBackdrop, exitOverlay } from "../ui/overlay";
import type { GameSettings } from "./MenuScene";
import type { SettingsSceneData } from "./SettingsScene";

export class PauseScene extends Phaser.Scene {
    constructor() {
        super(SCENES.pause);
    }

    create(settings: GameSettings): void {
        createBackdrop(this);

        const title = neonText(this, WIDTH / 2, HEIGHT * 0.3, t("paused"), {
            size: 72,
            weight: 900,
            color: CSS.cyan,
            glow: 24,
        });
        this.tweens.add({ targets: title, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });

        const menu: MenuList = new MenuList(
            this,
            WIDTH / 2,
            HEIGHT * 0.46,
            [
                { label: () => t("resume"), onSelect: () => this.resume() },
                {
                    label: () => t("restart"),
                    onSelect: () => {
                        menu.setEnabled(false);
                        exitOverlay(this, SCENES.game, settings);
                    },
                },
                { label: () => t("settings"), onSelect: () => this.openSettings() },
                {
                    label: () => t("mainMenu"),
                    onSelect: () => {
                        menu.setEnabled(false);
                        exitOverlay(this, SCENES.menu);
                    },
                },
            ],
            { onBack: () => this.resume() },
        );

        // Grace period so the key press that paused does not instantly resume.
        let ready = false;
        menu.setEnabled(false);
        this.time.delayedCall(150, () => {
            ready = true;
            menu.setEnabled(true);
        });
        this.input.keyboard?.on("keydown-P", () => ready && this.resume());

        applyNeonPost(this);
    }

    private openSettings(): void {
        const data: SettingsSceneData = { from: SCENES.pause, allowLanguage: false };
        this.scene.launch(SCENES.settings, data);
        this.scene.pause();
    }

    private resume(): void {
        audio.setMuffled(false);
        this.scene.resume(SCENES.game);
        this.scene.stop();
    }
}
