import Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH } from "../config";
import { theme } from "../theme";

export const TEXTURES = {
    sky: "sky",
    sun: "sun",
    spark: "spark",
    /** Hard-edged square particle for the Old School styles. */
    pixel: "pixel",
} as const;

/** Particle texture for the active style. */
export function particleTexture(): string {
    return theme().pixel ? TEXTURES.pixel : TEXTURES.spark;
}

/** Full-screen backdrop for gameplay and overlays: gradient sky in neon, flat color in Old School. */
export function addBackdrop(scene: Phaser.Scene): void {
    if (theme().pixel) {
        scene.add.rectangle(0, 0, WIDTH, HEIGHT, theme().background).setOrigin(0);
    } else {
        scene.add.image(0, 0, TEXTURES.sky).setOrigin(0).setDisplaySize(WIDTH, HEIGHT);
    }
}

/** Procedural textures: no image files to load. Called once by the Boot scene. */
export function createTextures(scene: Phaser.Scene): void {
    const toCss = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

    const sky = scene.textures.createCanvas(TEXTURES.sky, 4, HEIGHT)!;
    const skyCtx = sky.getContext();
    const skyGradient = skyCtx.createLinearGradient(0, 0, 0, HEIGHT);
    skyGradient.addColorStop(0, toCss(COLORS.bgTop));
    skyGradient.addColorStop(0.55, "#120624");
    skyGradient.addColorStop(1, toCss(COLORS.bgBottom));
    skyCtx.fillStyle = skyGradient;
    skyCtx.fillRect(0, 0, 4, HEIGHT);
    sky.refresh();

    const sunSize = 320;
    const sun = scene.textures.createCanvas(TEXTURES.sun, sunSize, sunSize)!;
    const sunCtx = sun.getContext();
    const sunGradient = sunCtx.createLinearGradient(0, 0, 0, sunSize);
    sunGradient.addColorStop(0, "#fff275");
    sunGradient.addColorStop(0.5, "#ff8c42");
    sunGradient.addColorStop(1, "#ff2a6d");
    sunCtx.fillStyle = sunGradient;
    sunCtx.beginPath();
    sunCtx.arc(sunSize / 2, sunSize / 2, sunSize / 2, 0, Math.PI * 2);
    sunCtx.fill();

    // Retro horizontal cuts, thicker towards the bottom.
    for (let i = 0; i < 7; i++) {
        const y = sunSize * 0.55 + i * i * 2.2 + i * 10;
        sunCtx.clearRect(0, y, sunSize, 2 + i * 1.6);
    }
    sun.refresh();

    const sparkSize = 16;
    const spark = scene.textures.createCanvas(TEXTURES.spark, sparkSize, sparkSize)!;
    const sparkCtx = spark.getContext();
    const sparkGradient = sparkCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    sparkGradient.addColorStop(0, "rgba(255,255,255,1)");
    sparkGradient.addColorStop(0.4, "rgba(255,255,255,0.8)");
    sparkGradient.addColorStop(1, "rgba(255,255,255,0)");
    sparkCtx.fillStyle = sparkGradient;
    sparkCtx.fillRect(0, 0, sparkSize, sparkSize);
    spark.refresh();

    const pixel = scene.textures.createCanvas(TEXTURES.pixel, 6, 6)!;
    const pixelCtx = pixel.getContext();
    pixelCtx.fillStyle = "#ffffff";
    pixelCtx.fillRect(0, 0, 6, 6);
    pixel.refresh();
}

/**
 * Menu backdrop. Neon: gradient sky, optional striped sun and a perspective floor grid scrolling towards the viewer.
 * Old School: flat screen color with a double pixel frame, like a handheld bezel.
 */
export class Background {
    /** Neon only: the animated perspective floor. */
    private floor!: Phaser.GameObjects.Graphics;
    private readonly horizon: number;
    private readonly speed: number;

    /** `demo`: Old School attract-mode snake under the title (menu only; it would cross other layouts). */
    constructor(scene: Phaser.Scene, { horizon = HEIGHT * 0.58, sun = true, speed = 0.25, demo = true } = {}) {
        this.horizon = horizon;
        this.speed = speed;

        if (theme().pixel) {
            const style = theme();
            const frame = scene.add.graphics();
            frame.fillStyle(style.background, 1);
            frame.fillRect(0, 0, WIDTH, HEIGHT);
            frame.lineStyle(8, style.text.dim, 1);
            frame.strokeRect(16, 16, WIDTH - 32, HEIGHT - 32);
            frame.lineStyle(4, style.text.text, 1);
            frame.strokeRect(32, 32, WIDTH - 64, HEIGHT - 64);
            if (demo) {
                this.addDemoSnake(scene);
            }
            return;
        }

        scene.add.image(0, 0, TEXTURES.sky).setOrigin(0).setDisplaySize(WIDTH, HEIGHT);

        if (sun) {
            const sunImage = scene.add.image(WIDTH / 2, horizon - 60, TEXTURES.sun).setAlpha(0.9);
            scene.tweens.add({
                targets: sunImage,
                y: sunImage.y - 6,
                duration: 3000,
                yoyo: true,
                repeat: -1,
                ease: "Sine.InOut",
            });
        }

        this.floor = scene.add.graphics();
        scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
        });
    }

    /** Attract-mode snake circling under the title, like old cartridge title screens. */
    private addDemoSnake(scene: Phaser.Scene): void {
        const style = theme();
        const cell = 20;
        const cols = 22;
        const rows = 4;
        const left = (WIDTH - cols * cell) / 2;
        const top = HEIGHT * 0.33;

        // Perimeter of a cols x rows rectangle, clockwise.
        const path: { x: number; y: number }[] = [];
        for (let x = 0; x < cols; x++) path.push({ x, y: 0 });
        for (let y = 1; y < rows; y++) path.push({ x: cols - 1, y });
        for (let x = cols - 2; x >= 0; x--) path.push({ x, y: rows - 1 });
        for (let y = rows - 2; y > 0; y--) path.push({ x: 0, y });

        const length = 9;
        const g = scene.add.graphics();
        let head = 0;
        scene.time.addEvent({
            delay: 110,
            loop: true,
            callback: () => {
                head = (head + 1) % path.length;
                g.clear();
                for (let i = 0; i < length; i++) {
                    const p = path[(head - i + path.length) % path.length];
                    g.fillStyle(i === 0 ? style.snakeHead : style.snakeBody[0], 1);
                    g.fillRect(left + p.x * cell + 2, top + p.y * cell + 2, cell - 4, cell - 4);
                }
            },
        });
    }

    private update(time: number): void {
        const g = this.floor;
        const top = this.horizon;
        const depth = HEIGHT - top;
        const centerX = WIDTH / 2;

        g.clear();
        g.fillStyle(0x0b0418, 1);
        g.fillRect(0, top, WIDTH, depth);

        // Horizon line.
        g.lineStyle(2, COLORS.magenta, 0.9);
        g.lineBetween(0, top, WIDTH, top);

        // Vertical lines converge on the vanishing point.
        g.lineStyle(1.5, COLORS.purple, 0.55);
        const lines = 18;
        for (let i = -lines; i <= lines; i++) {
            const bottomX = centerX + i * 90;
            g.lineBetween(centerX + i * 6, top, bottomX, HEIGHT);
        }

        // Horizontal lines: quadratic spacing fakes perspective, the phase offset makes them scroll.
        const rows = 12;
        const phase = ((time / 1000) * this.speed) % 1;
        for (let i = 0; i < rows; i++) {
            const z = (i + phase) / rows;
            const y = top + depth * z * z;
            g.lineStyle(1.5, COLORS.magenta, 0.25 + 0.6 * z);
            g.lineBetween(0, y, WIDTH, y);
        }
    }
}
