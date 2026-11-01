import Phaser from "phaser";
import { BOARD_H, BOARD_W, BOARD_X, BOARD_Y, CONTROLS_Y, TOUCH_LAYOUT, WIDTH } from "../config";
import { type Direction, DIRECTION_VECTORS } from "../core/types";
import { t } from "../i18n";
import { type DpadSide, getSettings } from "../storage";
import { theme } from "../theme";
import { gameText, vibrate } from "./neon";

/** Logical px a finger must travel before a swipe counts. */
const SWIPE_THRESHOLD = 26;
const BUTTON_RADIUS = 50;
const BUTTON_GAP = 108;

const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

/** Horizontal center of the D-pad so the outer buttons keep a margin from the screen edge. */
function dpadX(side: DpadSide): number {
    const reach = BUTTON_GAP + BUTTON_RADIUS + 24;
    return side === "left" ? BOARD_X + reach - 24 : side === "right" ? BOARD_X + BOARD_W - reach + 24 : WIDTH / 2;
}

/**
 * Swipe anywhere (always on for touch devices) plus an optional on-screen D-pad.
 * Swipes re-anchor after each turn, so one continuous gesture can chain several turns.
 */
export class TouchControls {
    private anchor: { x: number; y: number } | null = null;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly onTurn: (direction: Direction) => void,
    ) {
        if (!scene.sys.game.device.input.touch) {
            return;
        }

        scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleDown, this);
        scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handleMove, this);
        scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleUp, this);

        if (getSettings().touch === "dpad") {
            this.createDpad();
        } else if (TOUCH_LAYOUT) {
            gameText(scene, WIDTH / 2, CONTROLS_Y, t("swipeHint"), { size: 18, color: "dim", glow: 0, weight: 400 });
        }
    }

    private handleDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
        // Presses on buttons (D-pad, pause) are not swipes.
        this.anchor = over.length > 0 ? null : { x: pointer.x, y: pointer.y };
    }

    private handleMove(pointer: Phaser.Input.Pointer): void {
        if (!this.anchor || !pointer.isDown) {
            return;
        }

        const dx = pointer.x - this.anchor.x;
        const dy = pointer.y - this.anchor.y;

        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
            return;
        }

        const direction: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        this.onTurn(direction);
        this.anchor = { x: pointer.x, y: pointer.y };
    }

    private handleUp(): void {
        this.anchor = null;
    }

    private createDpad(): void {
        // Portrait phones: dedicated strip below the board. Otherwise a translucent pad over the bottom of the board.
        const center = { x: dpadX(getSettings().dpadSide), y: TOUCH_LAYOUT ? CONTROLS_Y : BOARD_Y + BOARD_H - BUTTON_GAP - 20 };
        const alpha = TOUCH_LAYOUT ? 1 : 0.45;
        const style = theme();

        for (const direction of DIRECTIONS) {
            const v = DIRECTION_VECTORS[direction];
            const button = this.scene.add.graphics({ x: center.x + v.x * BUTTON_GAP, y: center.y + v.y * BUTTON_GAP });
            button.fillStyle(style.board, 0.85);
            button.fillCircle(0, 0, BUTTON_RADIUS);
            button.lineStyle(3, style.text.primary, 0.9);
            button.strokeCircle(0, 0, BUTTON_RADIUS);

            // Arrow triangle pointing along the direction vector.
            const tip = { x: v.x * 20, y: v.y * 20 };
            const side = { x: -v.y * 16, y: v.x * 16 };
            const back = { x: -v.x * 10, y: -v.y * 10 };
            button.fillStyle(style.text.primary, 1);
            button.fillTriangle(tip.x, tip.y, back.x + side.x, back.y + side.y, back.x - side.x, back.y - side.y);
            button.setAlpha(alpha);

            button.setInteractive(new Phaser.Geom.Circle(0, 0, BUTTON_RADIUS), Phaser.Geom.Circle.Contains);
            button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
                this.onTurn(direction);
                vibrate(8);
                this.scene.tweens.add({ targets: button, scale: 0.88, duration: 50, yoyo: true });
            });
        }
    }
}
