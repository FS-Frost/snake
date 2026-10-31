import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { CSS, HEIGHT, SCENES, WIDTH } from "../config";
import { getLanguage, type Language, setLanguage, t } from "../i18n";
import { getSettings, type TouchScheme, updateSettings } from "../storage";
import { type MenuItem, MenuList } from "../ui/MenuList";
import { applyNeonPost, isBloomAvailable, neonText, refreshNeonPost, shake } from "../ui/neon";
import { createBackdrop } from "../ui/overlay";

export interface SettingsSceneData {
    /** Scene that opened settings; it is paused meanwhile and resumed on close. */
    from: string;
    /** Language changes rebuild every text, which only the menu does cleanly. */
    allowLanguage: boolean;
}

const LANGUAGES: readonly Language[] = ["en", "es"];
const TOUCH_SCHEMES: readonly TouchScheme[] = ["swipe", "dpad"];

const clampVolume = (value: number) => Math.max(0, Math.min(10, value));
const onOff = (value: boolean) => (value ? t("on") : t("off"));
const other = <T>(values: readonly T[], current: T) => values[(values.indexOf(current) + 1) % values.length];

export class SettingsScene extends Phaser.Scene {
    private openedWith!: SettingsSceneData;
    private initialLanguage!: Language;

    constructor() {
        super(SCENES.settings);
    }

    create(data: SettingsSceneData): void {
        this.openedWith = data;
        this.initialLanguage = getLanguage();
        createBackdrop(this, 0.9);

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
                label: () => `${t("touch")}: ${t(`touch.${getSettings().touch}`)}`,
                onChange: () => updateSettings({ touch: other(TOUCH_SCHEMES, getSettings().touch) }),
            },
        ];

        if (data.allowLanguage) {
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

        const title = neonText(this, WIDTH / 2, top - 100, t("settings"), { size: 54, weight: 900, color: CSS.white });
        title.setShadow(0, 0, CSS.cyan, 22, false, true);

        const menu = new MenuList(this, WIDTH / 2, top, items, {
            spacing,
            size: 24,
            onBack: () => this.close(),
        });

        applyNeonPost(this);
    }

    private close(): void {
        const { from } = this.openedWith;

        if (getLanguage() !== this.initialLanguage) {
            // Rebuild the caller so its static texts pick up the new language.
            this.scene.stop(from);
            this.scene.start(from);
            return;
        }

        this.scene.resume(from);
        this.scene.stop();
    }
}
