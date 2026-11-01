import Phaser from "phaser";
import {
    BOARD_H,
    BOARD_W,
    BOARD_X,
    BOARD_Y,
    CONTROLS_Y,
    HEIGHT,
    LAYOUT,
    LEFT_X,
    RENDER_SCALE,
    RIGHT_X,
    SIDE_W,
    WIDTH,
} from "../config";
import { type Direction, DIRECTION_VECTORS } from "../core/types";
import { t } from "../i18n";
import { type DpadSide, getSettings } from "../storage";
import { theme } from "../theme";
import { gameText, vibrate } from "./neon";

/** Logical px a finger must travel before a swipe counts. */
const SWIPE_THRESHOLD = 26;
/** Square buttons, large enough for a thumb even after the canvas is scaled down on a phone. */
const BUTTON_SIZE = 124;
/** Center-to-center distance between the middle of the pad and each button. */
const BUTTON_STEP = BUTTON_SIZE + 10;
/** Touch target overflow around each button, so near-misses still count. */
const HIT_MARGIN = 8;

const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

/** Top of the portrait control strip (the 860 px desktop layout ends there). */
const PORTRAIT_STRIP_TOP = 860;

/** Full D-pad width (and height) at scale 1. */
const DPAD_SPAN = BUTTON_STEP * 2 + BUTTON_SIZE;

/** Portrait/desktop: horizontal center of the D-pad, flush with the board edge on the chosen side. */
function dpadX(side: DpadSide): number {
    const half = DPAD_SPAN / 2;
    return side === "left" ? BOARD_X + half : side === "right" ? BOARD_X + BOARD_W - half : WIDTH / 2;
}

/** Margin between a landscape D-pad and the bottom edge. */
const LANDSCAPE_BOTTOM = 24;

/** Shrinks the pad only when its area is too small (tablets in portrait, narrow landscape columns). */
function dpadScale(): number {
    switch (LAYOUT) {
        case "portrait":
            return Math.min(1, (HEIGHT - PORTRAIT_STRIP_TOP - 24) / DPAD_SPAN);
        case "landscape":
            // At most ~55% of the height, so the HUD keeps the top of each column.
            return Math.min(1, (SIDE_W - 24) / DPAD_SPAN, (HEIGHT * 0.55) / DPAD_SPAN);
        default:
            return 0.6;
    }
}

/**
 * Landscape D-pads sit at the bottom of both side columns. Returns their vertical center and the
 * top edge, so the HUD knows how much of the column it can use.
 */
export function landscapeDpadBox(): { y: number; top: number } {
    const span = DPAD_SPAN * dpadScale();
    const y = HEIGHT - LANDSCAPE_BOTTOM - span / 2;
    return { y, top: y - span / 2 };
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
        } else if (LAYOUT !== "desktop") {
            const landscape = LAYOUT === "landscape";
            const x = landscape ? RIGHT_X : WIDTH / 2;
            const y = landscape ? landscapeDpadBox().y : CONTROLS_Y;
            const hint = gameText(scene, x, y, t("swipeHint"), { size: 18, color: "dim", glow: 0, weight: 400 });
            // Landscape column is narrow: wrap the hint instead of overflowing onto the board.
            if (LAYOUT === "landscape") {
                hint.setWordWrapWidth(SIDE_W - 40).setAlign("center");
            }
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

        // Pointer coordinates are canvas pixels; the threshold is in logical pixels.
        const dx = (pointer.x - this.anchor.x) / RENDER_SCALE;
        const dy = (pointer.y - this.anchor.y) / RENDER_SCALE;

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
        // Portrait: dedicated strip below the board. Landscape: one pad per side column, for either thumb.
        // Desktop with a touchscreen: translucent pad over the bottom of the board.
        if (LAYOUT === "landscape") {
            const { y } = landscapeDpadBox();
            this.createPad({ x: LEFT_X, y });
            this.createPad({ x: RIGHT_X, y });
            return;
        }

        const scale = dpadScale();
        this.createPad({
            x: dpadX(getSettings().dpadSide),
            y: LAYOUT === "portrait" ? CONTROLS_Y : BOARD_Y + BOARD_H - (DPAD_SPAN * scale) / 2 - 12,
        });
    }

    private createPad(center: { x: number; y: number }): void {
        const scale = dpadScale();
        const alpha = LAYOUT === "desktop" ? 0.45 : 1;
        const style = theme();
        const half = BUTTON_SIZE / 2;
        const radius = style.pixel ? 0 : 18;

        for (const direction of DIRECTIONS) {
            const v = DIRECTION_VECTORS[direction];
            const x = center.x + v.x * BUTTON_STEP * scale;
            const y = center.y + v.y * BUTTON_STEP * scale;

            const button = this.scene.add.graphics({ x, y });
            button.fillStyle(style.board, 0.9);
            button.fillRoundedRect(-half, -half, BUTTON_SIZE, BUTTON_SIZE, radius);
            button.lineStyle(style.pixel ? 6 : 4, style.text.primary, 1);
            button.strokeRoundedRect(-half, -half, BUTTON_SIZE, BUTTON_SIZE, radius);

            // Arrow triangle pointing along the direction vector.
            const tip = { x: v.x * 30, y: v.y * 30 };
            const side = { x: -v.y * 26, y: v.x * 26 };
            const back = { x: -v.x * 16, y: -v.y * 16 };
            button.fillStyle(style.text.primary, 1);
            button.fillTriangle(tip.x, tip.y, back.x + side.x, back.y + side.y, back.x - side.x, back.y - side.y);
            button.setAlpha(alpha).setScale(scale);

            // Press flash: the whole key lights up, which reads better under a thumb than a scale bounce.
            const glow = this.scene.add.graphics({ x, y }).setScale(scale).setAlpha(0);
            glow.fillStyle(style.text.primary, 1);
            glow.fillRoundedRect(-half, -half, BUTTON_SIZE, BUTTON_SIZE, radius);

            const hit = half + HIT_MARGIN;
            button.setInteractive(new Phaser.Geom.Rectangle(-hit, -hit, hit * 2, hit * 2), Phaser.Geom.Rectangle.Contains);
            button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
                this.onTurn(direction);
                vibrate(8);
                this.scene.tweens.killTweensOf(glow);
                glow.setAlpha(0.45);
                this.scene.tweens.add({ targets: glow, alpha: 0, duration: 160 });
            });
        }
    }
}
