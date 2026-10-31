import Phaser from "phaser";
import { BOARD_H, BOARD_W, BOARD_X, BOARD_Y, CELL, COLORS, CSS, WIDTH } from "../config";
import { type Item, RULES, type SnakeGame } from "../core/SnakeGame";
import type { Cell, EffectType, ItemType } from "../core/types";
import { itemLabel, t } from "../i18n";
import { neonText } from "../ui/neon";

export const cellX = (x: number) => BOARD_X + x * CELL + CELL / 2;
export const cellY = (y: number) => BOARD_Y + y * CELL + CELL / 2;

export const ITEM_COLORS: Record<ItemType, number> = {
    golden: COLORS.yellow,
    slowmo: COLORS.cyan,
    ghost: COLORS.white,
    scissors: COLORS.orange,
};

/** Seconds before expiry when the item starts blinking. */
const BLINK_MS = 2000;

/**
 * Special item on the board: per-type procedural icon plus a ring that drains as it expires.
 */
export class ItemView {
    private readonly g: Phaser.GameObjects.Graphics;
    private current: Item | null = null;
    private spawnedAt = 0;

    constructor(private readonly scene: Phaser.Scene) {
        this.g = scene.add.graphics();
    }

    render(item: Item | null, clock: number): void {
        const g = this.g;
        const now = this.scene.time.now;
        g.clear();

        if (item !== this.current) {
            this.current = item;
            this.spawnedAt = now;
        }

        if (!item) {
            return;
        }

        const left = item.expiresAt - clock;
        // Blink faster as it is about to vanish.
        if (left < BLINK_MS && Math.floor(now / (left < BLINK_MS / 2 ? 80 : 160)) % 2 === 0) {
            return;
        }

        const x = cellX(item.cell.x);
        const y = cellY(item.cell.y);
        const color = ITEM_COLORS[item.type];
        const grow = Phaser.Math.Easing.Back.Out(Math.min(1, (now - this.spawnedAt) / 320));
        const r = CELL * 0.38 * grow;

        // Lifetime ring.
        const fraction = Phaser.Math.Clamp(left / RULES.itemLifetimeMs, 0, 1);
        g.lineStyle(2, color, 0.9);
        g.beginPath();
        g.arc(x, y, CELL * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
        g.strokePath();

        const spin = now / 400;
        switch (item.type) {
            case "golden":
                this.star(x, y, r, spin, color);
                break;
            case "slowmo":
                g.lineStyle(3, color, 1);
                g.strokeCircle(x, y, r);
                g.lineBetween(x, y, x, y - r * 0.7);
                g.lineBetween(x, y, x + Math.cos(spin) * r * 0.55, y + Math.sin(spin) * r * 0.55);
                break;
            case "ghost":
                g.fillStyle(color, 0.75 + Math.sin(now / 120) * 0.2);
                g.fillCircle(x, y - r * 0.15, r * 0.8);
                g.fillRect(x - r * 0.8, y - r * 0.15, r * 1.6, r * 0.9);
                g.fillStyle(COLORS.board, 1);
                g.fillCircle(x - r * 0.3, y - r * 0.2, r * 0.16);
                g.fillCircle(x + r * 0.3, y - r * 0.2, r * 0.16);
                break;
            case "scissors": {
                // Blades open and close around the pivot; handles are two rings at the bottom.
                const open = 0.35 + Math.abs(Math.sin(now / 180)) * 0.25;
                g.lineStyle(3, color, 1);
                for (const side of [-1, 1]) {
                    const tipX = x + side * Math.sin(open) * r;
                    const tipY = y - Math.cos(open) * r;
                    const handleX = x - side * Math.sin(open) * r * 0.7;
                    const handleY = y + Math.cos(open) * r * 0.7;
                    g.lineBetween(tipX, tipY, handleX, handleY);
                    g.strokeCircle(handleX, handleY + 3, 4);
                }
                g.fillStyle(COLORS.white, 1);
                g.fillCircle(x, y, 2.5);
                break;
            }
        }
    }

    private star(x: number, y: number, r: number, angle: number, color: number): void {
        const points: Phaser.Math.Vector2[] = [];
        for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? r : r * 0.45;
            const a = angle + (i * Math.PI) / 5 - Math.PI / 2;
            points.push(new Phaser.Math.Vector2(x + Math.cos(a) * radius, y + Math.sin(a) * radius));
        }
        this.g.fillStyle(color, 1);
        this.g.fillPoints(points, true);
    }
}

/** Obstacle blocks. Each new piece drops in with a flash so it never appears unnoticed. */
export class ObstacleView {
    constructor(private readonly scene: Phaser.Scene) {}

    add(cells: Cell[]): void {
        cells.forEach((cell, index) => {
            const size = CELL - 4;
            const block = this.scene.add.graphics({ x: cellX(cell.x), y: cellY(cell.y) });
            block.fillStyle(0x2a0b4a, 1);
            block.fillRoundedRect(-size / 2, -size / 2, size, size, 5);
            block.lineStyle(2, COLORS.magenta, 1);
            block.strokeRoundedRect(-size / 2 + 1, -size / 2 + 1, size - 2, size - 2, 5);
            block.lineStyle(1, COLORS.magenta, 0.6);
            block.lineBetween(-size / 4, -size / 4, size / 4, size / 4);
            block.lineBetween(size / 4, -size / 4, -size / 4, size / 4);

            block.setScale(2.2).setAlpha(0);
            this.scene.tweens.add({
                targets: block,
                scale: 1,
                alpha: 1,
                delay: index * 70,
                duration: 280,
                ease: "Back.Out",
            });
        });
    }
}

/**
 * Combo meter next to the score and timed-effect bars in the footer.
 */
export class PowerHud {
    private readonly comboText: Phaser.GameObjects.Text;
    private readonly bars: Phaser.GameObjects.Graphics;
    private readonly effectLabels: Record<EffectType, Phaser.GameObjects.Text>;
    private readonly slowmoTint: Phaser.GameObjects.Rectangle;
    private lastCombo = 1;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly comboX: number,
        private readonly comboY: number,
        private readonly footerY: number,
    ) {
        // Cyan wash over the board while time is slowed.
        this.slowmoTint = scene.add
            .rectangle(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, COLORS.cyan, 0.07)
            .setOrigin(0)
            .setVisible(false);

        neonText(scene, comboX, comboY - 38, t("combo"), { size: 13, color: CSS.dim, glow: 0, weight: 400, align: "left" });
        this.comboText = neonText(scene, comboX, comboY, "", { size: 28, color: CSS.magenta, weight: 500, glow: 6, align: "left" });
        this.bars = scene.add.graphics();

        const label = (effect: EffectType) =>
            neonText(scene, WIDTH / 2, footerY - 8, itemLabel(effect), {
                size: 12,
                color: effect === "slowmo" ? CSS.cyan : CSS.white,
                glow: 4,
                weight: 700,
            }).setVisible(false);
        this.effectLabels = { slowmo: label("slowmo"), ghost: label("ghost") };
    }

    /** Depth so the tint sits between the board and the snake. */
    get tint(): Phaser.GameObjects.Rectangle {
        return this.slowmoTint;
    }

    update(logic: SnakeGame): void {
        const g = this.bars;
        g.clear();

        // Combo.
        const remaining = logic.comboRemaining();
        if (logic.combo > 1 && remaining > 0) {
            this.comboText.setAlpha(1).setText(`x${logic.combo}`);
            if (logic.combo !== this.lastCombo) {
                this.scene.tweens.add({ targets: this.comboText, scale: 1.35, duration: 90, yoyo: true });
            }
            g.fillStyle(COLORS.magenta, 0.9);
            g.fillRect(this.comboX, this.comboY + 20, 56 * remaining, 4);
        } else {
            // Idle meter stays visible but dim, so the column does not pop in and out.
            this.comboText.setAlpha(0.35).setText("x1");
        }
        this.lastCombo = logic.combo;

        // Effects: centered, side by side when both run.
        const active = (["slowmo", "ghost"] as const).filter((effect) => logic.isActive(effect));
        const width = 120;
        active.forEach((effect, index) => {
            const x = WIDTH / 2 + (index - (active.length - 1) / 2) * (width + 24);
            const color = effect === "slowmo" ? COLORS.cyan : COLORS.white;
            this.effectLabels[effect].setVisible(true).setX(x);
            g.fillStyle(color, 0.25);
            g.fillRect(x - width / 2, this.footerY + 6, width, 5);
            g.fillStyle(color, 1);
            g.fillRect(x - width / 2, this.footerY + 6, width * logic.effectRemaining(effect), 5);
        });
        for (const effect of ["slowmo", "ghost"] as const) {
            if (!active.includes(effect)) {
                this.effectLabels[effect].setVisible(false);
            }
        }

        const slowmo = logic.isActive("slowmo");
        this.slowmoTint.setVisible(slowmo);
        if (slowmo) {
            this.slowmoTint.setAlpha(0.6 + Math.sin(this.scene.time.now / 300) * 0.4);
        }
    }
}
