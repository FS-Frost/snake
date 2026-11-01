import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { COLORS, HEIGHT, SCENES, WIDTH } from "../config";
import { DIFFICULTIES, type Difficulty, MODES, type Mode } from "../core/types";
import { difficultyLabel, modeLabel, styleSettingLabel, t } from "../i18n";
import { installOption, onInstallChange, promptInstall } from "../install";
import { getHighScore, getLastSelection, getSettings, setLastSelection, updateSettings } from "../storage";
import { shuffleSurprise, STYLE_SETTINGS, textCss, theme, toCss } from "../theme";
import { Background } from "../ui/Background";
import { type MenuItem, MenuList } from "../ui/MenuList";
import { applyNeonPost, fadeIn, gameText, transitionTo } from "../ui/neon";
import type { MessageSceneData } from "./MessageScene";
import type { SettingsSceneData } from "./SettingsScene";

export interface GameSettings {
    mode: Mode;
    difficulty: Difficulty;
}

export interface MenuSceneData {
    /** Item to focus after a self-restart (style preview, install availability change). */
    focus?: number;
    /** Skip the fade-in: restarts for a live style preview must feel instant. */
    instant?: boolean;
}

function cycle<T>(values: readonly T[], current: T, delta: number): T {
    const index = values.indexOf(current);
    return values[(index + delta + values.length) % values.length];
}

const ITEM_SPACING = 52;

/** The "press any key" title only shows once per session; it doubles as the audio unlock gesture. */
let pressedStart = false;

export class MenuScene extends Phaser.Scene {
    private settings!: GameSettings;
    private bestText: Phaser.GameObjects.Text | null = null;

    constructor() {
        super(SCENES.menu);
    }

    create(data: MenuSceneData = {}): void {
        this.settings = getLastSelection();
        this.bestText = null;
        audio.setChiptune(theme().pixel);
        // Letterbox bars around the canvas follow the style (light LCD palettes would look framed in black).
        document.body.style.background = toCss(theme().background);
        new Background(this);
        this.createTitle();
        applyNeonPost(this);
        if (!data.instant) {
            fadeIn(this);
        }

        // A new install option (prompt became available, app got installed) rebuilds the menu.
        const unsubscribe = onInstallChange(() => {
            if (pressedStart && this.scene.isActive()) {
                this.restart({ instant: true });
            }
        });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

        if (pressedStart) {
            audio.setMusic("title");
            this.createPanel(data.focus);
        } else {
            this.createPressStart();
        }
    }

    private createPressStart(): void {
        const prompt = gameText(this, WIDTH / 2, HEIGHT * 0.75, t("tapToStart"), { size: 24, color: "primary", glow: 12 });
        this.tweens.add({ targets: prompt, alpha: 0.2, duration: 650, yoyo: true, repeat: -1, ease: "Sine.InOut" });

        const start = () => {
            if (pressedStart) {
                return;
            }

            pressedStart = true;
            audio.unlock();
            audio.setMusic("title");
            audio.uiSelect();
            this.tweens.killTweensOf(prompt);
            this.tweens.add({ targets: prompt, alpha: 0, scale: 1.4, duration: 200, onComplete: () => prompt.destroy() });
            // Next frame, so the same key press is not also read by the menu.
            this.time.delayedCall(60, () => this.createPanel());
        };

        this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, start);
        this.input.once(Phaser.Input.Events.POINTER_UP, start);
    }

    /** First launch asks for a style; afterwards the regular menu. */
    private createPanel(focus?: number): void {
        if (getSettings().styleChosen) {
            this.createMenu(focus);
        } else {
            this.createStyleChooser();
        }
    }

    /**
     * First-launch style picker. Moving the focus applies that style and rebuilds the whole screen,
     * so the player sees exactly what they pick.
     */
    private createStyleChooser(): void {
        const items: MenuItem[] = STYLE_SETTINGS.map((style) => ({
            label: () => styleSettingLabel(style),
            onSelect: () => {
                updateSettings({ styleChosen: true });
                this.restart();
            },
        }));

        const top = this.drawPanel(items.length, true);
        gameText(this, WIDTH / 2, top + 36, t("chooseStyle"), { size: 22, color: "highlight", glow: 8 });

        new MenuList(this, WIDTH / 2, top + 36 + ITEM_SPACING, items, {
            spacing: ITEM_SPACING,
            focus: STYLE_SETTINGS.indexOf(getSettings().style),
            onFocus: (index) => {
                // Previewing "surprise" shows a random style each time it gets focus.
                if (STYLE_SETTINGS[index] === "surprise") {
                    shuffleSurprise();
                }
                updateSettings({ style: STYLE_SETTINGS[index] });
                this.restart({ instant: true });
            },
        });
    }

    private createMenu(focus?: number): void {
        const items: MenuItem[] = [
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
            {
                label: () => `${t("style")}: ${styleSettingLabel(getSettings().style)}`,
                onChange: (delta) => {
                    const next = cycle(STYLE_SETTINGS, getSettings().style, delta);
                    if (next === "surprise") {
                        shuffleSurprise();
                    }
                    updateSettings({ style: next });
                    // Rebuild in the new style right away; keep focus on this item.
                    this.restart({ instant: true, focus: 3 });
                },
            },
            {
                label: () => t("fonoteca"),
                onSelect: () => {
                    setLastSelection(this.settings.mode, this.settings.difficulty);
                    transitionTo(this, SCENES.fonoteca);
                },
            },
            { label: () => t("settings"), onSelect: () => this.openSettings() },
        ];

        const install = installOption();
        if (install) {
            items.push({ label: () => t("install"), onSelect: () => this.install(install) });
        }

        const top = this.drawPanel(items.length, false);
        const menu: MenuList = new MenuList(this, WIDTH / 2, top + 40, items, {
            spacing: ITEM_SPACING,
            focus,
            onUpdate: () => this.updateBest(),
        });

        this.bestText = gameText(this, WIDTH / 2, top + 40 + items.length * ITEM_SPACING, "", {
            size: 18,
            color: "highlight",
            glow: 6,
        });
        this.updateBest();

        if (!this.sys.game.device.input.touch) {
            gameText(this, WIDTH / 2, HEIGHT - (theme().pixel ? 52 : 22), t("menuHint"), {
                size: 14,
                color: "dim",
                glow: 0,
                weight: 400,
            });
        }
    }

    /**
     * Options panel anchored to the bottom so it never collides with the title, whatever the screen height.
     * Returns the panel's top y.
     */
    private drawPanel(itemCount: number, withHeading: boolean): number {
        const style = theme();
        const height = (itemCount + 1) * ITEM_SPACING + (withHeading ? 20 : 30);
        // Old School keeps clear of the bezel frame (inset 32 px); desktop leaves room for the key hint.
        const touch = this.sys.game.device.input.touch;
        const bottomPad = style.pixel ? (touch ? 60 : 80) : touch ? 40 : 48;
        const top = Math.round(HEIGHT - height - bottomPad);
        const left = WIDTH / 2 - 300;
        const panel = this.add.graphics();

        // Glass over the neon grid, a hard-edged box in Old School.
        if (style.pixel) {
            panel.fillStyle(style.background, 1);
            panel.fillRect(left, top, 600, height);
            panel.lineStyle(4, style.text.text, 1);
            panel.strokeRect(left, top, 600, height);
        } else {
            panel.fillStyle(COLORS.bgTop, 0.78);
            panel.fillRoundedRect(left, top, 600, height, 18);
            panel.lineStyle(2, COLORS.purple, 0.7);
            panel.strokeRoundedRect(left, top, 600, height, 18);
        }

        return top;
    }

    private async install(option: "prompt" | "ios"): Promise<void> {
        if (option === "prompt") {
            await promptInstall();
            return;
        }

        const data: MessageSceneData = {
            from: SCENES.menu,
            title: t("install"),
            lines: [t("iosStep1"), t("iosStep2"), t("iosStep3")],
        };
        this.scene.launch(SCENES.message, data);
        this.scene.pause();
    }

    private openSettings(): void {
        const data: SettingsSceneData = { from: SCENES.menu, fromMenu: true };
        this.scene.launch(SCENES.settings, data);
        this.scene.pause();
    }

    /** Self-restart that keeps unsaved mode and difficulty choices. */
    private restart(data: MenuSceneData = {}): void {
        setLastSelection(this.settings.mode, this.settings.difficulty);
        this.scene.restart(data);
    }

    private createTitle(): void {
        const y = HEIGHT * 0.14;

        if (theme().pixel) {
            // Hard drop shadow instead of glow, like a cartridge title screen.
            const title = gameText(this, WIDTH / 2, y + 20, t("title"), { size: 120, color: "text" });
            title.setShadow(6, 6, textCss("dim"), 0, false, true);
            gameText(this, WIDTH / 2, y + 120, t("oldSchool"), { size: 26, color: "secondary" }).setLetterSpacing(8);
            return;
        }

        // Chromatic offset copies behind the title for a glitchy CRT feel.
        const ghostCyan = gameText(this, WIDTH / 2 - 3, y, t("title"), { size: 120, weight: 900, color: "primary", glow: 0 });
        const ghostPink = gameText(this, WIDTH / 2 + 3, y, t("title"), { size: 120, weight: 900, color: "danger", glow: 0 });
        ghostCyan.setAlpha(0.6);
        ghostPink.setAlpha(0.6);
        const title = gameText(this, WIDTH / 2, y, t("title"), { size: 120, weight: 900, color: "text", glow: 28 });
        title.setShadow(0, 0, textCss("danger"), 28, false, true);

        gameText(this, WIDTH / 2, y + 86, t("subtitle"), { size: 26, color: "primary", glow: 10 }).setLetterSpacing(16);

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
        this.bestText?.setText(`${t("best")}  ${best.toString().padStart(6, "0")}`);
    }

    private startGame(menu: MenuList): void {
        menu.setEnabled(false);
        setLastSelection(this.settings.mode, this.settings.difficulty);
        transitionTo(this, SCENES.game, { ...this.settings });
    }
}
