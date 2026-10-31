import Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH } from "../config";

export const TEXTURES = {
    sky: "sky",
    sun: "sun",
    spark: "spark",
} as const;

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
}

/**
 * Synthwave backdrop: gradient sky, optional striped sun and a perspective floor grid scrolling towards the viewer.
 */
export class Background {
    private readonly floor: Phaser.GameObjects.Graphics;
    private readonly horizon: number;
    private readonly speed: number;

    constructor(scene: Phaser.Scene, { horizon = HEIGHT * 0.58, sun = true, speed = 0.25 } = {}) {
        this.horizon = horizon;
        this.speed = speed;

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
