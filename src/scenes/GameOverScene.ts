import Phaser from "phaser";
import { audio } from "../audio/Audio";
import { HEIGHT, SCENES, WIDTH } from "../config";
import { type TextRole, textCss, theme } from "../theme";
import { t } from "../i18n";
import { MenuList } from "../ui/MenuList";
import { applyNeonPost, gameText } from "../ui/neon";
import { createBackdrop, exitOverlay } from "../ui/overlay";
import type { GameOverData } from "./GameScene";

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super(SCENES.gameOver);
    }

    create(data: GameOverData): void {
        createBackdrop(this, 0.8);
        this.createTitle(data.won ? t("victory") : t("gameOver"), data.won ? "highlight" : "danger");

        // Score counts up instead of appearing.
        const score = gameText(this, WIDTH / 2, HEIGHT * 0.36, "0", { size: 84, weight: 500, color: "primary", glow: 14 });
        const counter = { value: 0 };
        this.tweens.add({
            targets: counter,
            value: data.score,
            duration: Math.min(1200, 300 + data.score * 2),
            delay: 350,
            ease: "Cubic.Out",
            onUpdate: () => score.setText(String(Math.round(counter.value))),
        });

        const seconds = Math.floor(data.timeMs / 1000);
        const time = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
        const stats = `${t("best")} ${data.best}  ·  ${t("level")} ${data.level}  ·  ${t("length")} ${data.length}  ·  ${t("time")} ${time}`;
        gameText(this, WIDTH / 2, HEIGHT * 0.45, stats, { size: 16, color: "dim", glow: 0, weight: 400 });

        if (data.isRecord) {
            const badge = gameText(this, WIDTH / 2, HEIGHT * 0.52, t("newRecord"), {
                size: 30,
                weight: 900,
                color: "highlight",
                glow: 20,
            });
            // Rotated pixel text turns jagged, so Old School keeps it straight.
            badge.setScale(0).setAngle(theme().pixel ? 0 : -6);
            this.tweens.add({
                targets: badge,
                scale: 1,
                delay: 1300,
                duration: 400,
                ease: "Back.Out",
                onStart: () => audio.fanfare(),
            });
            this.tweens.add({ targets: badge, alpha: 0.55, delay: 1700, duration: 450, yoyo: true, repeat: -1 });
        }

        const menu = new MenuList(this, WIDTH / 2, HEIGHT * 0.64, [
            {
                label: () => t("retry"),
                onSelect: () => {
                    menu.setEnabled(false);
                    exitOverlay(this, SCENES.game, data.settings);
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

        // Blocks accidental instant retry from keys still held when the snake died.
        menu.setEnabled(false);
        this.time.delayedCall(600, () => menu.setEnabled(true));

        // Music comes back calm after the crash.
        this.time.delayedCall(1800, () => audio.setMusic("menu"));

        applyNeonPost(this);
    }

    private createTitle(label: string, color: TextRole): void {
        const y = HEIGHT * 0.22;

        if (theme().pixel) {
            // Classic cartridge game over: hard shadow, three blinks, then steady.
            const title = gameText(this, WIDTH / 2, y, label, { size: 64, color });
            title.setShadow(4, 4, textCss("dim"), 0, false, true);
            this.time.addEvent({ delay: 180, repeat: 5, callback: () => title.setVisible(!title.visible) });
            return;
        }

        const ghostA = gameText(this, WIDTH / 2, y, label, { size: 64, weight: 900, color: "primary", glow: 0 }).setAlpha(0.5);
        const ghostB = gameText(this, WIDTH / 2, y, label, { size: 64, weight: 900, color: "danger", glow: 0 }).setAlpha(0.5);
        const title = gameText(this, WIDTH / 2, y, label, { size: 64, weight: 900, color: "text", glow: 26 });
        title.setShadow(0, 0, textCss(color), 26, false, true);

        title.setScale(2.4).setAlpha(0);
        this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 320, ease: "Expo.Out" });

        // RGB split glitch that settles.
        this.time.addEvent({
            delay: 70,
            repeat: 14,
            callback: () => {
                const spread = Phaser.Math.Between(-12, 12);
                ghostA.setPosition(WIDTH / 2 - spread, y + Phaser.Math.Between(-3, 3));
                ghostB.setPosition(WIDTH / 2 + spread, y + Phaser.Math.Between(-3, 3));
            },
        });
        this.time.delayedCall(70 * 15 + 10, () => {
            ghostA.setPosition(WIDTH / 2 - 2, y);
            ghostB.setPosition(WIDTH / 2 + 2, y);
        });
    }
}
