import Phaser from "phaser";
import { HEIGHT, WIDTH } from "../config";
import { DEBUG } from "../debug";
import { getSettings } from "../storage";
import { type TextRole, textCss, theme } from "../theme";

export interface GameTextOptions {
    size?: number;
    color?: TextRole;
    weight?: 400 | 500 | 700 | 900;
    /** Glow radius in px (neon style only). 0 disables the glow. */
    glow?: number;
    align?: "left" | "center" | "right";
}

/** Smallest on-screen size in CSS px; below this, phone text becomes unreadable. */
const MIN_SCREEN_PX = { neon: 12, pixel: 10 };

/** How many CSS px one logical px takes with Scale.FIT. */
function screenScale(): number {
    return Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
}

/**
 * Text in the active style: Orbitron with a glow in neon, a crisp pixel font in the Old School styles.
 * Sizes are given for the neon font and scaled for the wider pixel font.
 */
export function gameText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: string,
    { size = 24, color = "text", weight = 700, glow = 12, align = "center" }: GameTextOptions = {},
): Phaser.GameObjects.Text {
    const style = theme();
    const css = textCss(color);
    const glowPx = style.glow ? glow : 0;
    // Grow small labels so they stay legible when the canvas is scaled down (phones).
    const minLogical = (style.pixel ? MIN_SCREEN_PX.pixel : MIN_SCREEN_PX.neon) / screenScale();
    const scaled = style.pixel ? size * style.fontScale : size;
    // Pixel fonts stay sharp on multiples of 4 px.
    const fontSize = style.pixel
        ? Math.max(8, Math.ceil(Math.max(scaled, minLogical) / 4) * 4)
        : Math.ceil(Math.max(scaled, minLogical));

    const text = scene.add.text(x, y, content, {
        fontFamily: style.font,
        fontSize: `${fontSize}px`,
        fontStyle: style.pixel ? "400" : String(weight),
        color: css,
        align,
        // Extra room so the glow is not clipped by the text texture bounds.
        padding: { x: glowPx + 2, y: glowPx + 2 },
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        lineSpacing: style.pixel ? 8 : 0,
    });

    if (glowPx > 0) {
        text.setShadow(0, 0, css, glowPx, false, true);
    }

    if (style.pixel) {
        text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    const originX = align === "left" ? 0 : align === "right" ? 1 : 0.5;
    return text.setOrigin(originX, 0.5);
}

/** Recolors a text by role, keeping the style rules (glow only in neon). */
export function setTextRole(text: Phaser.GameObjects.Text, role: TextRole, glow = 0): void {
    const css = textCss(role);
    text.setColor(css);
    text.setShadow(0, 0, css, theme().glow ? glow : 0, false, true);
}

const BLOOM_KEY = "bloom";

/** Set by the Boot probe: some mobile GPUs render the bloom filters as a black screen. */
let bloomWorks = true;

export function setBloomWorks(works: boolean): void {
    bloomWorks = works;
}

/** False on Canvas, with ?bloom=0, or when the GPU failed the boot probe. The setting cannot override it. */
export function isBloomAvailable(game: Phaser.Game): boolean {
    return game.renderer.type === Phaser.WEBGL && !DEBUG.noBloom && bloomWorks && !theme().pixel;
}

export function addBloom(camera: Phaser.Cameras.Scene2D.Camera): Phaser.Filters.ParallelFilters {
    // High threshold: only saturated neon blooms, text keeps legible edges.
    const [bloom] = Phaser.Actions.AddEffectBloom(camera, {
        threshold: 0.62,
        blurRadius: 2,
        blurSteps: 3,
        blendAmount: 0.7,
    });
    return bloom.parallelFilters;
}

/** Bloom on the camera so every bright pixel glows. */
export function applyNeonPost(scene: Phaser.Scene): void {
    if (!isBloomAvailable(scene.game)) {
        return;
    }

    const filter = addBloom(scene.cameras.main);
    filter.active = getSettings().bloom;
    scene.data.set(BLOOM_KEY, filter);
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
