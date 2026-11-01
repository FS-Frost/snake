import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { HEIGHT, SCENES, WIDTH } from "../config";
import { getLanguage, type Language, setLanguage, t } from "../i18n";
import { type DpadSide, getSettings, type TouchScheme, updateSettings } from "../storage";
import { relayout } from "../relayout";
import { type Style, textCss, theme } from "../theme";
import { type MenuItem, MenuList } from "../ui/MenuList";
import { applyNeonPost, isBloomAvailable, gameText, refreshNeonPost, shake } from "../ui/neon";
import { createBackdrop } from "../ui/overlay";

export interface SettingsSceneData {
    /** Scene that opened settings; it is paused meanwhile and resumed on close. */
    from: string;
    /** Language and style rebuild every screen, which only the main menu does cleanly. */
    fromMenu: boolean;
    /** Carried across self-restarts (style preview) to know whether the caller must be rebuilt. */
    initial?: Initial;
    /** Item to focus after a self-restart. */
    focus?: number;
}

const LANGUAGES: readonly Language[] = ["en", "es"];

/** Values at open time, to know on close what must be rebuilt. */
interface Initial {
    language: Language;
    style: Style;
    touch: TouchScheme;
    dpadSide: DpadSide;
}

/** Touch scheme and D-pad side merged into one option: SWIPE, D-PAD LEFT, D-PAD CENTER, D-PAD RIGHT. */
const TOUCH_OPTIONS: readonly { touch: TouchScheme; dpadSide: DpadSide }[] = [
    { touch: "swipe", dpadSide: "center" },
    { touch: "dpad", dpadSide: "left" },
    { touch: "dpad", dpadSide: "center" },
    { touch: "dpad", dpadSide: "right" },
];

function touchIndex(): number {
    const { touch, dpadSide } = getSettings();
    return touch === "swipe" ? 0 : TOUCH_OPTIONS.findIndex((option) => option.dpadSide === dpadSide);
}

function touchLabel(): string {
    const { touch, dpadSide } = getSettings();
    return touch === "swipe" ? t("touch.swipe") : t(`touch.dpad.${dpadSide}`);
}

const clampVolume = (value: number) => Math.max(0, Math.min(10, value));
const onOff = (value: boolean) => (value ? t("on") : t("off"));
const other = <T>(values: readonly T[], current: T) => values[(values.indexOf(current) + 1) % values.length];

export class SettingsScene extends Phaser.Scene {
    private openedWith!: SettingsSceneData;
    private initial!: Initial;

    constructor() {
        super(SCENES.settings);
    }

    create(data: SettingsSceneData): void {
        this.openedWith = data;
        const { style, touch, dpadSide } = getSettings();
        this.initial = data.initial ?? { language: getLanguage(), style, touch, dpadSide };
        // After a style change the paused caller still shows the old style: hide it completely.
        createBackdrop(this, 0.9, getSettings().style !== this.initial.style);

        const items: MenuItem[] = [
            {
                label: () => `${t("music")}: ${getSettings().music * 10}%`,
                onChange: (delta) => {
                    updateSettings({ music: clampVolume(getSettings().music + delta) });
                    audio.applyVolumes();
                },
            },
            {
                label: () => `${t("sfx")}: ${getSettings().sfx * 10}%`,
                onChange: (delta) => {
                    updateSettings({ sfx: clampVolume(getSettings().sfx + delta) });
                    audio.applyVolumes();
                },
            },
            {
                // Locked on devices where bloom renders black, so it can never be switched back on there.
                label: () => `${t("bloom")}: ${isBloomAvailable(this.game) ? onOff(getSettings().bloom) : t("unavailable")}`,
                onChange: () => {
                    if (!isBloomAvailable(this.game)) {
                        return;
                    }
                    updateSettings({ bloom: !getSettings().bloom });
                    refreshNeonPost(this.game);
                },
            },
            {
                label: () => `${t("shake")}: ${onOff(getSettings().shake)}`,
                onChange: () => {
                    updateSettings({ shake: !getSettings().shake });
                    // Preview so the player feels what was enabled.
                    shake(this, 160, 0.006);
                },
            },
            {
                label: () => `${t("flash")}: ${onOff(getSettings().flash)}`,
                onChange: () => updateSettings({ flash: !getSettings().flash }),
            },
            {
                label: () => `${t("touch")}: ${touchLabel()}`,
                onChange: (delta) => {
                    const next = (touchIndex() + delta + TOUCH_OPTIONS.length) % TOUCH_OPTIONS.length;
                    updateSettings(TOUCH_OPTIONS[next]);
                },
            },
        ];

        if (data.fromMenu) {
            items.push({
                label: () => `${t("language")}: ${t(`language.${getLanguage()}`)}`,
                onChange: () => {
                    const next = other(LANGUAGES, getLanguage());
                    setLanguage(next);
                    updateSettings({ language: next });
                    // Every label is computed from t(), so a refresh re-translates the list in place.
                    menu.refresh();
                    title.setText(t("settings"));
                },
            });
        }

        items.push({ label: () => t("back"), onSelect: () => this.close() });

        const spacing = 60;
        const listHeight = (items.length - 1) * spacing;
        const top = HEIGHT / 2 - listHeight / 2 + 40;

        const title = gameText(this, WIDTH / 2, top - 100, t("settings"), { size: 54, weight: 900, color: "text" });
        title.setShadow(theme().pixel ? 4 : 0, theme().pixel ? 4 : 0, textCss(theme().pixel ? "dim" : "primary"), theme().pixel ? 0 : 22, false, true);

        const menu = new MenuList(this, WIDTH / 2, top, items, {
            spacing,
            size: 24,
            focus: data.focus,
            onBack: () => this.close(),
        });

        applyNeonPost(this);
    }

    private close(): void {
        const { from } = this.openedWith;

        // Landscape puts the D-pad and the HUD in side columns chosen by the D-pad side.
        if (getSettings().dpadSide !== this.initial.dpadSide || getSettings().touch !== this.initial.touch) {
            this.scene.stop();
            relayout(this.game, true);
            this.scene.resume(from);
            return;
        }

        if (getLanguage() !== this.initial.language || getSettings().style !== this.initial.style) {
            // Rebuild the caller so its static texts pick up the new language.
            this.scene.stop(from);
            this.scene.start(from);
            return;
        }

        this.scene.resume(from);
        this.scene.stop();
    }
}
