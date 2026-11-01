import Phaser from "phaser";
import { BOARD_H, BOARD_W, BOARD_X, BOARD_Y, CELL, GRID_COLS, GRID_ROWS } from "../config";
import { type Item, RULES, type SnakeGame } from "../core/SnakeGame";
import { type Cell, DIRECTION_VECTORS, type EffectType, type Mode } from "../core/types";
import { itemLabel, t } from "../i18n";
import { theme } from "../theme";
import { fitWidth, gameText } from "../ui/neon";

export const cellX = (x: number) => BOARD_X + x * CELL + CELL / 2;
export const cellY = (y: number) => BOARD_Y + y * CELL + CELL / 2;

/** Seconds before expiry when the item starts blinking. */
const BLINK_MS = 2000;
const SEGMENT_PADDING = 3;

// ---------------------------------------------------------------------- pixel art

/** 8x8 sprites for the Old School styles: "#" is ink, "." is transparent. */
const SPRITES = {
    food: ["...##...", "..#.....", ".######.", "########", "########", "########", ".######.", "..####.."],
    golden: ["...##...", "...##...", "########", ".######.", "..####..", ".##..##.", "##....##", "........"],
    slowmo: ["########", ".#....#.", "..#..#..", "...##...", "...##...", "..#..#..", ".#....#.", "########"],
    ghost: ["..####..", ".######.", "##.##.##", "##.##.##", "########", "########", "########", "#.#..#.#"],
    scissors: ["#.....#.", ".#...#..", "..#.#...", "...#....", "..#.#...", "##...##.", "##...##.", "........"],
    brick: ["########", "#...#...", "########", "..#...#.", "########", "#...#...", "########", "..#...#."],
} as const;

const SPRITE_PIXEL = 3;

/** Draws an 8x8 sprite centered on (cx, cy). */
function drawSprite(g: Phaser.GameObjects.Graphics, sprite: readonly string[], cx: number, cy: number, color: number): void {
    const size = sprite.length * SPRITE_PIXEL;
    const left = Math.round(cx - size / 2);
    const top = Math.round(cy - size / 2);
    g.fillStyle(color, 1);
    sprite.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            if (row[x] === "#") {
                g.fillRect(left + x * SPRITE_PIXEL, top + y * SPRITE_PIXEL, SPRITE_PIXEL, SPRITE_PIXEL);
            }
        }
    });
}

// ---------------------------------------------------------------------- board

/** Static board: background, grid and a border that tells the rules (solid kills, dashed wraps). */
export function drawBoard(scene: Phaser.Scene, mode: Mode): void {
    const style = theme();
    const g = scene.add.graphics();
    g.fillStyle(style.board, style.pixel ? 1 : 0.92);
    g.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    if (style.pixel) {
        // Subtle checkerboard, the usual handheld grid. Invisible on single-tone LCDs, which is fine.
        g.fillStyle(style.grid, 0.35);
        for (let y = 0; y < GRID_ROWS; y++) {
            for (let x = y % 2; x < GRID_COLS; x += 2) {
                g.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
            }
        }
    } else {
        // Dot grid at cell corners reads cleaner than full lines.
        g.fillStyle(style.grid, 1);
        for (let y = 1; y < GRID_ROWS; y++) {
            for (let x = 1; x < GRID_COLS; x++) {
                g.fillCircle(BOARD_X + x * CELL, BOARD_Y + y * CELL, 1.5);
            }
        }
    }

    if (mode === "classic") {
        g.lineStyle(style.pixel ? 6 : 4, style.text.danger, 1);
        g.strokeRect(BOARD_X - 3, BOARD_Y - 3, BOARD_W + 6, BOARD_H + 6);
        return;
    }

    g.fillStyle(style.text.primary, style.pixel ? 1 : 0.85);
    const dash = style.pixel ? 12 : 14;
    const gap = style.pixel ? 12 : 10;
    const thick = style.pixel ? 4 : 3;
    for (let d = 0; d < BOARD_W; d += dash + gap) {
        const w = Math.min(dash, BOARD_W - d);
        g.fillRect(BOARD_X + d, BOARD_Y - thick - 1, w, thick);
        g.fillRect(BOARD_X + d, BOARD_Y + BOARD_H + 1, w, thick);
    }
    for (let d = 0; d < BOARD_H; d += dash + gap) {
        const h = Math.min(dash, BOARD_H - d);
        g.fillRect(BOARD_X - thick - 1, BOARD_Y + d, thick, h);
        g.fillRect(BOARD_X + BOARD_W + 1, BOARD_Y + d, thick, h);
    }
}

// ---------------------------------------------------------------------- snake

export interface SnakeRenderState {
    /** 0..1 progress between ticks; ignored by the pixel styles, which move cell by cell. */
    alpha: number;
    dying: boolean;
    /** Segments already blown up by the death animation. */
    exploded: number;
}

export class SnakeView {
    private readonly g: Phaser.GameObjects.Graphics;

    constructor(private readonly scene: Phaser.Scene) {
        this.g = scene.add.graphics();
    }

    render(logic: SnakeGame, state: SnakeRenderState): void {
        const g = this.g;
        g.clear();
        // Ghost: translucent and flickering while it can pass through itself.
        g.setAlpha(logic.isActive("ghost") && !state.dying ? 0.45 + Math.sin(this.scene.time.now / 70) * 0.15 : 1);

        if (logic.snake.length === 0) {
            return;
        }

        if (theme().pixel) {
            this.renderBlocks(logic, state);
        } else {
            this.renderTube(logic, state);
        }
    }

    /** Old School: one block per cell, no interpolation, the head carries two pixel eyes. */
    private renderBlocks(logic: SnakeGame, { dying, exploded }: SnakeRenderState): void {
        const g = this.g;
        const style = theme();
        const nearColor = Phaser.Display.Color.ValueToColor(style.snakeBody[0]);
        const farColor = Phaser.Display.Color.ValueToColor(style.snakeBody[1]);
        const last = Math.max(1, logic.snake.length - 1);

        for (let i = logic.snake.length - 1; i >= 0; i--) {
            if (dying && i < exploded) {
                continue;
            }

            const cell = logic.snake[i];
            const mix = Phaser.Display.Color.Interpolate.ColorWithColor(nearColor, farColor, last, i);
            const body = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
            g.fillStyle(dying ? style.text.danger : i === 0 ? style.snakeHead : body, 1);
            g.fillRect(BOARD_X + cell.x * CELL + 2, BOARD_Y + cell.y * CELL + 2, CELL - 4, CELL - 4);
        }

        if (!dying) {
            const head = logic.snake[0];
            const v = DIRECTION_VECTORS[logic.direction];
            const cx = cellX(head.x) + v.x * 5;
            const cy = cellY(head.y) + v.y * 5;
            g.fillStyle(style.snakeDetail, 1);
            g.fillRect(cx - v.y * 6 - 2, cy + v.x * 6 - 2, 4, 4);
            g.fillRect(cx + v.y * 6 - 2, cy - v.x * 6 - 2, 4, 4);
        }
    }

    /**
     * Neon: one continuous tube through cell centers. Only the head and the tail are interpolated;
     * every joint in between sits on a real cell, so corners stay crisp.
     */
    private renderTube(logic: SnakeGame, { alpha, dying, exploded }: SnakeRenderState): void {
        const g = this.g;
        const style = theme();
        const { snake, previousSnake } = logic;

        const lerpCell = (from: Cell | undefined, to: Cell) => {
            // Wrapped this tick (or no history): snap instead of sliding across the board.
            const start = from && Math.abs(to.x - from.x) <= 1 && Math.abs(to.y - from.y) <= 1 ? from : to;
            return {
                x: cellX(start.x + (to.x - start.x) * alpha),
                y: cellY(start.y + (to.y - start.y) * alpha),
            };
        };

        const last = snake.length - 1;
        const points = [lerpCell(previousSnake[0], snake[0])];
        for (let i = 1; i <= last; i++) {
            points.push({ x: cellX(snake[i].x), y: cellY(snake[i].y) });
        }
        if (last > 0) {
            points.push(lerpCell(previousSnake[last], snake[last]));
        }

        const headColor = Phaser.Display.Color.ValueToColor(style.snakeBody[0]);
        const tailColor = Phaser.Display.Color.ValueToColor(style.snakeBody[1]);
        const maxThickness = CELL - SEGMENT_PADDING * 2 - 4;

        // Tail first so the head is drawn on top.
        for (let i = points.length - 1; i >= 1; i--) {
            if (dying && i - 1 < exploded) {
                continue;
            }

            const a = points[i - 1];
            const b = points[i];
            const mix = Phaser.Display.Color.Interpolate.ColorWithColor(headColor, tailColor, points.length, i);
            const color = dying ? style.text.danger : Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
            // Tapers over the last few joints.
            const thickness = maxThickness * Math.min(1, 0.4 + (points.length - 1 - i) * 0.1);

            g.fillStyle(color, 1);
            g.fillCircle(b.x, b.y, thickness / 2);

            // A gap longer than one cell means a wrap: two separate tube pieces, no line across the board.
            if (Math.abs(a.x - b.x) <= CELL + 0.5 && Math.abs(a.y - b.y) <= CELL + 0.5) {
                g.lineStyle(thickness, color, 1);
                g.lineBetween(a.x, a.y, b.x, b.y);
            }
        }

        if (dying && exploded > 0) {
            return;
        }

        const head = points[0];
        const size = CELL - SEGMENT_PADDING * 2;
        g.fillStyle(dying ? style.text.danger : style.snakeHead, 1);
        g.fillRoundedRect(head.x - size / 2, head.y - size / 2, size, size, 9);

        if (!dying) {
            // Eyes sit side by side, perpendicular to the heading.
            const v = DIRECTION_VECTORS[logic.direction];
            const cx = head.x + v.x * 4;
            const cy = head.y + v.y * 4;
            g.fillStyle(style.snakeDetail, 1);
            g.fillCircle(cx - v.y * 6, cy + v.x * 6, 3);
            g.fillCircle(cx + v.y * 6, cy - v.x * 6, 3);
        }
    }
}

// ---------------------------------------------------------------------- food

export class FoodView {
    private readonly g: Phaser.GameObjects.Graphics;
    private current: Cell | null = null;
    private spawnedAt = 0;

    constructor(private readonly scene: Phaser.Scene) {
        this.g = scene.add.graphics();
    }

    render(food: Cell | null): void {
        const g = this.g;
        const style = theme();
        const now = this.scene.time.now;
        g.clear();

        if (!food) {
            return;
        }

        if (food !== this.current) {
            this.current = food;
            this.spawnedAt = now;
        }

        const x = cellX(food.x);
        const y = cellY(food.y);

        if (style.pixel) {
            // Blinks twice when it appears, then stays solid.
            const age = now - this.spawnedAt;
            if (age < 400 && Math.floor(age / 100) % 2 === 1) {
                return;
            }
            drawSprite(g, SPRITES.food, x, y, style.food);
            return;
        }

        const spawn = Phaser.Math.Easing.Back.Out(Math.min(1, (now - this.spawnedAt) / 280));
        const pulse = 1 + Math.sin(now / 140) * 0.08;
        const radius = CELL * 0.3 * spawn * pulse;

        // Expanding ring loop.
        const ring = (now % 900) / 900;
        g.lineStyle(2, style.food, (1 - ring) * 0.8);
        g.strokeCircle(x, y, radius + ring * CELL * 0.5);

        g.fillStyle(style.food, 1);
        g.fillCircle(x, y, radius);
        g.fillStyle(style.text.text, 0.9);
        g.fillCircle(x - radius * 0.3, y - radius * 0.3, radius * 0.3);
    }
}

// ---------------------------------------------------------------------- items

/**
 * Special item on the board: per-type icon plus a lifetime indicator that drains as it expires.
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
        const style = theme();
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
        const color = style.items[item.type];
        const fraction = Phaser.Math.Clamp(left / RULES.itemLifetimeMs, 0, 1);

        if (style.pixel) {
            drawSprite(g, SPRITES[item.type], x, y, color);
            // Lifetime as a pixel bar under the sprite.
            g.fillStyle(color, 1);
            g.fillRect(Math.round(x - 12), Math.round(y + 14), Math.round(24 * fraction), 2);
            return;
        }

        const grow = Phaser.Math.Easing.Back.Out(Math.min(1, (now - this.spawnedAt) / 320));
        const r = CELL * 0.38 * grow;

        // Lifetime ring.
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
                g.fillStyle(style.board, 1);
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
                g.fillStyle(style.text.text, 1);
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

// ---------------------------------------------------------------------- obstacles

/** Obstacle blocks. Each new piece arrives animated so it never appears unnoticed. */
export class ObstacleView {
    constructor(private readonly scene: Phaser.Scene) {}

    /** `animate` false redraws existing obstacles silently (after a relayout). */
    add(cells: Cell[], animate = true): void {
        const style = theme();

        cells.forEach((cell, index) => {
            const block = this.scene.add.graphics({ x: cellX(cell.x), y: cellY(cell.y) });

            if (style.pixel) {
                block.fillStyle(style.obstacle, 1);
                block.fillRect(-CELL / 2 + 1, -CELL / 2 + 1, CELL - 2, CELL - 2);
                drawSprite(block, SPRITES.brick, 0, 0, style.obstacleDetail);

                if (!animate) {
                    return;
                }

                // Pixel styles do not scale smoothly: blink in instead.
                block.setVisible(false);
                this.scene.time.delayedCall(index * 60, () => {
                    this.scene.time.addEvent({ delay: 90, repeat: 6, callback: () => block.setVisible(!block.visible) });
                });
                return;
            }

            const size = CELL - 4;
            block.fillStyle(style.obstacle, 1);
            block.fillRoundedRect(-size / 2, -size / 2, size, size, 5);
            block.lineStyle(2, style.obstacleDetail, 1);
            block.strokeRoundedRect(-size / 2 + 1, -size / 2 + 1, size - 2, size - 2, 5);
            block.lineStyle(1, style.obstacleDetail, 0.6);
            block.lineBetween(-size / 4, -size / 4, size / 4, size / 4);
            block.lineBetween(size / 4, -size / 4, -size / 4, size / 4);

            if (!animate) {
                return;
            }

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

// ---------------------------------------------------------------------- HUD

export interface PowerHudLayout {
    comboX: number;
    comboY: number;
    comboAlign: "left" | "center";
    /** Center of the effect bars. */
    effectsX: number;
    effectsY: number;
    /** Landscape column: effects stack vertically instead of side by side. */
    stack: boolean;
    /** Max width of an effect label and bar (landscape column width). */
    slotWidth?: number;
}

/**
 * Combo meter and timed-effect bars.
 */
export class PowerHud {
    private readonly comboText: Phaser.GameObjects.Text;
    private readonly bars: Phaser.GameObjects.Graphics;
    private readonly effectLabels: Record<EffectType, Phaser.GameObjects.Text>;
    private readonly slowmoTint: Phaser.GameObjects.Rectangle;
    private lastCombo = 1;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly layout: PowerHudLayout,
    ) {
        const { comboX, comboY, comboAlign, effectsX, effectsY } = layout;
        // Wash over the board while time is slowed.
        this.slowmoTint = scene.add
            .rectangle(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, theme().items.slowmo, 0.07)
            .setOrigin(0)
            .setVisible(false);

        gameText(scene, comboX, comboY - 40, t("combo"), { size: 13, color: "dim", glow: 0, weight: 400, align: comboAlign });
        this.comboText = gameText(scene, comboX, comboY, "", { size: 28, color: "danger", weight: 500, glow: 6, align: comboAlign });
        this.bars = scene.add.graphics();

        const label = (effect: EffectType) =>
            gameText(scene, effectsX, effectsY - 8, itemLabel(effect), {
                size: 12,
                color: effect === "slowmo" ? "primary" : "text",
                glow: 4,
                weight: 700,
            }).setVisible(false);
        this.effectLabels = { slowmo: label("slowmo"), ghost: label("ghost") };
    }

    update(logic: SnakeGame): void {
        const g = this.bars;
        const style = theme();
        g.clear();

        // Combo.
        const remaining = logic.comboRemaining();
        if (logic.combo > 1 && remaining > 0) {
            this.comboText.setAlpha(1).setText(`x${logic.combo}`);
            if (logic.combo !== this.lastCombo) {
                this.scene.tweens.add({ targets: this.comboText, scale: 1.35, duration: 90, yoyo: true });
            }
            const { comboX, comboY, comboAlign } = this.layout;
            const barX = comboAlign === "center" ? comboX - 28 : comboX;
            g.fillStyle(style.text.danger, 0.9);
            g.fillRect(barX, comboY + 22, 56 * remaining, 4);
        } else {
            // Idle meter stays visible but dim, so the column does not pop in and out.
            this.comboText.setAlpha(0.35).setText("x1");
        }
        this.lastCombo = logic.combo;

        // Effects: centered, side by side when both run.
        const active = (["slowmo", "ghost"] as const).filter((effect) => logic.isActive(effect));
        const { effectsX, effectsY, stack } = this.layout;
        // Footer row: one half each when both run. Side column: stacked rows.
        const slot = stack ? Math.min(180, this.layout.slotWidth ?? 160) : active.length > 1 ? BOARD_W / 2 - 24 : BOARD_W / 2;
        const width = Math.min(160, slot);
        active.forEach((effect, index) => {
            const offset = index - (active.length - 1) / 2;
            const x = stack ? effectsX : effectsX + offset * (BOARD_W / 2);
            const y = stack ? effectsY + index * 52 : effectsY;
            const color = effect === "slowmo" ? style.text.primary : style.text.text;
            fitWidth(this.effectLabels[effect].setVisible(true).setPosition(x, y - 8), slot);
            g.fillStyle(color, 0.25);
            g.fillRect(x - width / 2, y + 10, width, 5);
            g.fillStyle(color, 1);
            g.fillRect(x - width / 2, y + 10, width * logic.effectRemaining(effect), 5);
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
