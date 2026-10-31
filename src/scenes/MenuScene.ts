import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { COLORS, CSS, HEIGHT, SCENES, WIDTH } from "../config";
import { DIFFICULTIES, type Difficulty, MODES, type Mode } from "../core/types";
import { difficultyLabel, modeLabel, t } from "../i18n";
import { getHighScore, getLastSelection, setLastSelection } from "../storage";
import { Background } from "../ui/Background";
import { MenuList } from "../ui/MenuList";
import { applyNeonPost, fadeIn, neonText, transitionTo } from "../ui/neon";
import type { SettingsSceneData } from "./SettingsScene";

export interface GameSettings {
    mode: Mode;
    difficulty: Difficulty;
}

function cycle<T>(values: readonly T[], current: T, delta: number): T {
    const index = values.indexOf(current);
    return values[(index + delta + values.length) % values.length];
}

/** The "press any key" title only shows once per session; it doubles as the audio unlock gesture. */
let pressedStart = false;

export class MenuScene extends Phaser.Scene {
    private settings!: GameSettings;
    private bestText!: Phaser.GameObjects.Text;

    constructor() {
        super(SCENES.menu);
    }

    create(): void {
        this.settings = getLastSelection();
        new Background(this);
        this.createTitle();
        applyNeonPost(this);
        fadeIn(this);

        if (pressedStart) {
            audio.setMusic("menu");
            this.createMenu();
        } else {
            this.createPressStart();
        }
    }

    private createPressStart(): void {
        const prompt = neonText(this, WIDTH / 2, HEIGHT * 0.75, t("tapToStart"), { size: 24, color: CSS.cyan, glow: 12 });
        this.tweens.add({ targets: prompt, alpha: 0.2, duration: 650, yoyo: true, repeat: -1, ease: "Sine.InOut" });

        const start = () => {
            if (pressedStart) {
                return;
            }

            pressedStart = true;
            audio.unlock();
            audio.setMusic("menu");
            audio.uiSelect();
            this.tweens.killTweensOf(prompt);
            this.tweens.add({ targets: prompt, alpha: 0, scale: 1.4, duration: 200, onComplete: () => prompt.destroy() });
            // Next frame, so the same key press is not also read by the menu.
            this.time.delayedCall(60, () => this.createMenu());
        };

        this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, start);
        this.input.once(Phaser.Input.Events.POINTER_UP, start);
    }

    private createMenu(): void {
        // Glass panel keeps the options legible over the moving grid.
        const panelY = HEIGHT * 0.6;
        const panelH = 300;
        const panel = this.add.graphics();
        panel.fillStyle(COLORS.bgTop, 0.78);
        panel.fillRoundedRect(WIDTH / 2 - 300, panelY, 600, panelH, 18);
        panel.lineStyle(2, COLORS.purple, 0.7);
        panel.strokeRoundedRect(WIDTH / 2 - 300, panelY, 600, panelH, 18);

        const menu: MenuList = new MenuList(
            this,
            WIDTH / 2,
            panelY + 44,
            [
                { label: () => t("play"), onSelect: () => this.startGame(menu) },
                {
                    label: () => `${t("mode")}: ${modeLabel(this.settings.mode)}`,
                    onChange: (delta) => {
                        this.settings.mode = cycle(MODES, this.settings.mode, delta);
                    },
                },
                {
                    label: () => `${t("difficulty")}: ${difficultyLabel(this.settings.difficulty)}`,
                    onChange: (delta) => {
                        this.settings.difficulty = cycle(DIFFICULTIES, this.settings.difficulty, delta);
                    },
                },
                { label: () => t("settings"), onSelect: () => this.openSettings() },
            ],
            { spacing: 56, onUpdate: () => this.updateBest() },
        );

        this.bestText = neonText(this, WIDTH / 2, panelY + panelH - 36, "", { size: 18, color: CSS.yellow, glow: 6 });
        this.updateBest();

        if (!this.sys.game.device.input.touch) {
            neonText(this, WIDTH / 2, HEIGHT - 22, t("menuHint"), { size: 14, color: CSS.dim, glow: 0, weight: 400 });
        }
    }

    private openSettings(): void {
        const data: SettingsSceneData = { from: SCENES.menu, allowLanguage: true };
        this.scene.launch(SCENES.settings, data);
        this.scene.pause();
    }

    private createTitle(): void {
        const y = HEIGHT * 0.14;
        // Chromatic offset copies behind the title for a glitchy CRT feel.
        const ghostCyan = neonText(this, WIDTH / 2 - 3, y, t("title"), { size: 120, weight: 900, color: CSS.cyan, glow: 0 });
        const ghostPink = neonText(this, WIDTH / 2 + 3, y, t("title"), { size: 120, weight: 900, color: CSS.magenta, glow: 0 });
        ghostCyan.setAlpha(0.6);
        ghostPink.setAlpha(0.6);
        const title = neonText(this, WIDTH / 2, y, t("title"), { size: 120, weight: 900, color: CSS.white, glow: 28 });
        title.setShadow(0, 0, CSS.magenta, 28, false, true);

        neonText(this, WIDTH / 2, y + 86, t("subtitle"), { size: 26, color: CSS.cyan, glow: 10 }).setLetterSpacing(16);

        // Neon tube flicker plus occasional glitch jitter.
        this.time.addEvent({
            delay: 120,
            loop: true,
            callback: () => {
                const glitch = Math.random() < 0.06;
                title.setAlpha(Math.random() < 0.04 ? 0.55 : 1);
                ghostCyan.x = WIDTH / 2 - (glitch ? 10 : 3);
                ghostPink.x = WIDTH / 2 + (glitch ? 10 : 3);
            },
        });
    }

    private updateBest(): void {
        const best = getHighScore(this.settings.mode, this.settings.difficulty);
        this.bestText.setText(`${t("best")}  ${best.toString().padStart(6, "0")}`);
    }

    private startGame(menu: MenuList): void {
        menu.setEnabled(false);
        setLastSelection(this.settings.mode, this.settings.difficulty);
        transitionTo(this, SCENES.game, { ...this.settings });
    }
}
