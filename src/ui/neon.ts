import Phaser from "phaser";
import { FONT } from "../config";
import { DEBUG } from "../debug";
import { getSettings } from "../storage";

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

const BLOOM_KEY = "bloom";

/** Bloom on the camera so every bright pixel glows. WebGL only; Canvas renderer skips it. */
export function applyNeonPost(scene: Phaser.Scene): void {
    if (scene.renderer.type !== Phaser.WEBGL || DEBUG.noBloom) {
        return;
    }

    // High threshold: only saturated neon blooms, text keeps legible edges.
    const [bloom] = Phaser.Actions.AddEffectBloom(scene.cameras.main, {
        threshold: 0.62,
        blurRadius: 2,
        blurSteps: 3,
        blendAmount: 0.7,
    });
    bloom.parallelFilters.active = getSettings().bloom;
    scene.data.set(BLOOM_KEY, bloom.parallelFilters);
}

/** Applies the bloom setting to every running scene, so the toggle is visible immediately. */
export function refreshNeonPost(game: Phaser.Game): void {
    for (const scene of game.scene.getScenes(false)) {
        const filter = scene.data?.get(BLOOM_KEY) as Phaser.Filters.ParallelFilters | undefined;

        if (filter) {
            filter.active = getSettings().bloom;
        }
    }
}

export function shake(scene: Phaser.Scene, duration: number, intensity: number): void {
    if (getSettings().shake) {
        scene.cameras.main.shake(duration, intensity);
    }
}

export function flash(scene: Phaser.Scene, duration: number, color: number): void {
    if (getSettings().flash) {
        const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);
        scene.cameras.main.flash(duration, r, g, b);
    }
}

/** Short vibration on phones; tied to the shake setting since both are physical feedback. */
export function vibrate(pattern: number | number[]): void {
    if (getSettings().shake) {
        navigator.vibrate?.(pattern);
    }
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
