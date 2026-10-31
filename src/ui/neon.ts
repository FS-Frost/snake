import Phaser from "phaser";
import { FONT } from "../config";

export interface NeonTextOptions {
    size?: number;
    color?: string;
    weight?: 400 | 500 | 700 | 900;
    /** Glow radius in px. 0 disables the glow. */
    glow?: number;
    align?: "left" | "center" | "right";
}

/** Text with a canvas-shadow glow in its own color. */
export function neonText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: string,
    { size = 24, color = "#f4f1ff", weight = 700, glow = 12, align = "center" }: NeonTextOptions = {},
): Phaser.GameObjects.Text {
    const text = scene.add.text(x, y, content, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: String(weight),
        color,
        align,
        // Extra room so the glow is not clipped by the text texture bounds.
        padding: { x: glow, y: glow },
        resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    if (glow > 0) {
        text.setShadow(0, 0, color, glow, false, true);
    }

    const originX = align === "left" ? 0 : align === "right" ? 1 : 0.5;
    return text.setOrigin(originX, 0.5);
}

/** Bloom on the camera so every bright pixel glows. WebGL only; Canvas renderer skips it. */
export function applyNeonPost(scene: Phaser.Scene): void {
    if (scene.renderer.type !== Phaser.WEBGL) {
        return;
    }

    // High threshold: only saturated neon blooms, text keeps legible edges.
    Phaser.Actions.AddEffectBloom(scene.cameras.main, {
        threshold: 0.62,
        blurRadius: 2,
        blurSteps: 3,
        blendAmount: 0.7,
    });
}

const FADE_MS = 220;

/** Fades out, then starts `key`. Ignores repeated calls while a transition is running. */
export function transitionTo(scene: Phaser.Scene, key: string, data?: object): void {
    const camera = scene.cameras.main;

    if (camera.fadeEffect.isRunning) {
        return;
    }

    camera.fadeOut(FADE_MS, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

export function fadeIn(scene: Phaser.Scene): void {
    scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
}
