import Phaser from "phaser";
import {
    BOARD_H,
    BOARD_W,
    BOARD_X,
    BOARD_Y,
    CELL,
    COLORS,
    CSS,
    GRID_COLS,
    GRID_ROWS,
    HEIGHT,
    SCENES,
    WIDTH,
} from "../config";
import { audio } from "../audio/Audio";
import { SPEED_CURVES, ticksPerSecond } from "../core/difficulty";
import { SnakeGame } from "../core/SnakeGame";
import { type Cell, DIRECTION_VECTORS, type Direction } from "../core/types";
import { difficultyLabel, modeLabel, t } from "../i18n";
import { getHighScore, getSettings, submitScore } from "../storage";
import { TEXTURES } from "../ui/Background";
import { applyNeonPost, fadeIn, flash, neonText, shake, vibrate } from "../ui/neon";
import { TouchControls } from "../ui/TouchControls";
import type { GameSettings } from "./MenuScene";

type Phase = "countdown" | "playing" | "dying" | "over";

export interface GameOverData {
    settings: GameSettings;
    score: number;
    best: number;
    isRecord: boolean;
    won: boolean;
    length: number;
    timeMs: number;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
};

/** Large frame gaps (tab switch, debugger) must not fast-forward the snake into a wall. */
const MAX_FRAME_MS = 250;
const COUNTDOWN_STEP_MS = 550;
const SEGMENT_PADDING = 3;

const cellX = (x: number) => BOARD_X + x * CELL + CELL / 2;
const cellY = (y: number) => BOARD_Y + y * CELL + CELL / 2;

export class GameScene extends Phaser.Scene {
    private settings!: GameSettings;
    private logic!: SnakeGame;
    private phase: Phase = "countdown";
    private accumulator = 0;
    private elapsedMs = 0;
    private best = 0;

    private snakeGfx!: Phaser.GameObjects.Graphics;
    private foodGfx!: Phaser.GameObjects.Graphics;
    private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
    private scoreText!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private speedText!: Phaser.GameObjects.Text;

    private foodSpawnedAt = 0;
    private lastFood: Cell | null = null;
    /** Segments already blown up during the death animation. */
    private explodedSegments = 0;

    constructor() {
        super(SCENES.game);
    }

    create(settings: GameSettings): void {
        this.settings = settings;
        this.logic = new SnakeGame({
            cols: GRID_COLS,
            rows: GRID_ROWS,
            mode: settings.mode,
            difficulty: settings.difficulty,
        });
        this.phase = "countdown";
        this.accumulator = 0;
        this.elapsedMs = 0;
        this.explodedSegments = 0;
        this.best = getHighScore(settings.mode, settings.difficulty);
        this.lastFood = null;

        this.add.image(0, 0, TEXTURES.sky).setOrigin(0).setDisplaySize(WIDTH, HEIGHT);
        this.drawBoard();
        this.foodGfx = this.add.graphics();
        this.snakeGfx = this.add.graphics();
        this.sparks = this.add.particles(0, 0, TEXTURES.spark, {
            speed: { min: 80, max: 260 },
            lifespan: { min: 300, max: 650 },
            scale: { start: 0.9, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: Phaser.BlendModes.ADD,
            emitting: false,
        });
        this.createHud();
        new TouchControls(this, (direction) => this.turn(direction));

        this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey, this);
        this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
        this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPause, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey, this);
            this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
            this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPause, this);
        });

        applyNeonPost(this);
        fadeIn(this);
        audio.setMusic("game");
        audio.setIntensity(0);
        audio.setMuffled(false);
        this.runCountdown();
    }

    update(_time: number, delta: number): void {
        if (this.phase === "playing") {
            const frame = Math.min(delta, MAX_FRAME_MS);
            this.elapsedMs += frame;
            this.accumulator += frame;

            while (this.phase === "playing" && this.accumulator >= this.logic.tickMs) {
                this.accumulator -= this.logic.tickMs;
                this.tick();
            }
        }

        const alpha = this.phase === "playing" ? this.accumulator / this.logic.tickMs : 1;
        this.renderSnake(alpha);
        this.renderFood();
        this.updateHud();
    }

    private tick(): void {
        const result = this.logic.step();

        if (result.ate) {
            this.onEat();
        }

        if (result.died) {
            this.onDeath();
        } else if (result.won) {
            this.onWin();
        }
    }

    // ---------------------------------------------------------------- input

    private handleKey(event: KeyboardEvent): void {
        const direction = KEY_DIRECTIONS[event.code];

        if (direction) {
            this.turn(direction);
            return;
        }

        if (event.code === "Escape" || event.code === "KeyP") {
            this.pause();
        }
    }

    private turn(direction: Direction): void {
        if (this.phase === "playing" || this.phase === "countdown") {
            this.logic.queueTurn(direction);
        }
    }

    private autoPause(): void {
        if (this.scene.isActive()) {
            this.pause();
        }
    }

    private pause(): void {
        if (this.phase !== "playing" && this.phase !== "countdown") {
            return;
        }

        audio.pause();
        audio.setMuffled(true);
        this.scene.launch(SCENES.pause, this.settings);
        this.scene.pause();
    }

    // ---------------------------------------------------------------- flow

    private runCountdown(): void {
        const labels = ["3", "2", "1", t("go")];
        const touch = this.sys.game.device.input.touch;
        const hintText = !touch ? t("gameHint") : getSettings().touch === "swipe" ? t("swipeHint") : "";
        const hint = neonText(this, WIDTH / 2, BOARD_Y + BOARD_H * 0.68, hintText, {
            size: 16,
            color: CSS.dim,
            glow: 0,
            weight: 400,
        });

        labels.forEach((label, index) => {
            this.time.delayedCall(index * COUNTDOWN_STEP_MS, () => {
                const isLast = index === labels.length - 1;
                audio.countdown(isLast);
                const text = neonText(this, WIDTH / 2, BOARD_Y + BOARD_H / 2, label, {
                    size: isLast ? 96 : 120,
                    weight: 900,
                    color: isLast ? CSS.yellow : CSS.cyan,
                    glow: 24,
                });
                text.setScale(1.8).setAlpha(0);
                this.tweens.add({
                    targets: text,
                    scale: 1,
                    alpha: 1,
                    duration: 180,
                    ease: "Back.Out",
                    onComplete: () => {
                        this.tweens.add({
                            targets: text,
                            alpha: 0,
                            scale: 0.6,
                            delay: COUNTDOWN_STEP_MS - 300,
                            duration: 160,
                            onComplete: () => text.destroy(),
                        });
                    },
                });

                if (isLast) {
                    this.phase = "playing";
                    this.tweens.add({ targets: hint, alpha: 0, duration: 300, onComplete: () => hint.destroy() });
                }
            });
        });
    }

    private onEat(): void {
        const head = this.logic.head;
        const x = cellX(head.x);
        const y = cellY(head.y);

        this.sparks.setParticleTint(COLORS.magenta);
        this.sparks.explode(18, x, y);
        this.sparks.setParticleTint(COLORS.yellow);
        this.sparks.explode(6, x, y);

        const points = SPEED_CURVES[this.settings.difficulty].points;
        const popup = neonText(this, x, y - 10, `+${points}`, { size: 20, color: CSS.yellow, glow: 10 });
        this.tweens.add({
            targets: popup,
            y: y - 50,
            alpha: 0,
            duration: 650,
            ease: "Cubic.Out",
            onComplete: () => popup.destroy(),
        });

        this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 70, yoyo: true });
        shake(this, 80, 0.002);
        vibrate(12);
        audio.eat(this.logic.foodsEaten);
        audio.setIntensity(this.logic.foodsEaten / 30);
    }

    private onDeath(): void {
        this.phase = "dying";
        shake(this, 380, 0.014);
        flash(this, 180, COLORS.magenta);
        vibrate([60, 40, 120]);
        audio.die();
        audio.setMusic("off");

        // Blow the body up from head to tail; long snakes speed up so it never drags.
        const segments = this.logic.snake.length;
        const interval = Math.max(12, Math.min(45, 700 / segments));
        this.time.addEvent({
            delay: interval,
            repeat: segments - 1,
            callback: () => {
                const cell = this.logic.snake[this.explodedSegments];
                this.sparks.setParticleTint(this.explodedSegments === 0 ? COLORS.white : COLORS.magenta);
                this.sparks.explode(this.explodedSegments === 0 ? 30 : 8, cellX(cell.x), cellY(cell.y));
                this.explodedSegments++;
            },
        });

        this.time.delayedCall(segments * interval + 650, () => this.finish(false));
    }

    private onWin(): void {
        this.phase = "dying";
        flash(this, 400, COLORS.yellow);
        audio.setMusic("off");
        audio.fanfare();

        for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 180, () => {
                this.sparks.setParticleTint(i % 2 === 0 ? COLORS.yellow : COLORS.cyan);
                this.sparks.explode(40, Phaser.Math.Between(BOARD_X, BOARD_X + BOARD_W), Phaser.Math.Between(BOARD_Y, BOARD_Y + BOARD_H));
            });
        }

        this.time.delayedCall(1400, () => this.finish(true));
    }

    private finish(won: boolean): void {
        this.phase = "over";
        const isRecord = submitScore(this.settings.mode, this.settings.difficulty, this.logic.score);
        const data: GameOverData = {
            settings: this.settings,
            score: this.logic.score,
            best: Math.max(this.best, this.logic.score),
            isRecord,
            won,
            length: this.logic.snake.length,
            timeMs: this.elapsedMs,
        };

        this.scene.launch(SCENES.gameOver, data);
        this.scene.pause();
    }

    // ---------------------------------------------------------------- drawing

    private drawBoard(): void {
        const g = this.add.graphics();
        g.fillStyle(COLORS.board, 0.92);
        g.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

        // Dot grid at cell corners reads cleaner than full lines.
        g.fillStyle(COLORS.grid, 1);
        for (let y = 1; y < GRID_ROWS; y++) {
            for (let x = 1; x < GRID_COLS; x++) {
                g.fillCircle(BOARD_X + x * CELL, BOARD_Y + y * CELL, 1.5);
            }
        }

        // Border tells the rules: solid magenta walls kill, dashed cyan edges let you through.
        if (this.settings.mode === "classic") {
            g.lineStyle(4, COLORS.magenta, 1);
            g.strokeRect(BOARD_X - 2, BOARD_Y - 2, BOARD_W + 4, BOARD_H + 4);
        } else {
            g.fillStyle(COLORS.cyan, 0.85);
            const dash = 14;
            const gap = 10;
            for (let d = 0; d < BOARD_W; d += dash + gap) {
                const w = Math.min(dash, BOARD_W - d);
                g.fillRect(BOARD_X + d, BOARD_Y - 4, w, 3);
                g.fillRect(BOARD_X + d, BOARD_Y + BOARD_H + 1, w, 3);
            }
            for (let d = 0; d < BOARD_H; d += dash + gap) {
                const h = Math.min(dash, BOARD_H - d);
                g.fillRect(BOARD_X - 4, BOARD_Y + d, 3, h);
                g.fillRect(BOARD_X + BOARD_W + 1, BOARD_Y + d, 3, h);
            }
        }
    }

    /**
     * Draws the snake as one continuous tube through cell centers. Only the head and the tail
     * are interpolated; every joint in between sits on a real cell, so corners stay crisp.
     */
    private renderSnake(alpha: number): void {
        const g = this.snakeGfx;
        const { snake, previousSnake } = this.logic;
        const dying = this.phase === "dying" || this.phase === "over";
        g.clear();

        if (snake.length === 0) {
            return;
        }

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

        const headColor = Phaser.Display.Color.ValueToColor(COLORS.cyan);
        const tailColor = Phaser.Display.Color.ValueToColor(COLORS.purple);
        const maxThickness = CELL - SEGMENT_PADDING * 2 - 4;

        // Tail first so the head is drawn on top.
        for (let i = points.length - 1; i >= 1; i--) {
            if (dying && i - 1 < this.explodedSegments) {
                continue;
            }

            const a = points[i - 1];
            const b = points[i];
            const mix = Phaser.Display.Color.Interpolate.ColorWithColor(headColor, tailColor, points.length, i);
            const color = dying ? COLORS.magenta : Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
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

        if (dying && this.explodedSegments > 0) {
            return;
        }

        const head = points[0];
        const size = CELL - SEGMENT_PADDING * 2;
        g.fillStyle(dying ? COLORS.magenta : COLORS.white, 1);
        g.fillRoundedRect(head.x - size / 2, head.y - size / 2, size, size, 9);

        if (!dying) {
            this.drawEyes(head);
        }
    }

    /** `head` is the center of the head. */
    private drawEyes(head: { x: number; y: number }): void {
        const g = this.snakeGfx;
        const v = DIRECTION_VECTORS[this.logic.direction];
        const cx = head.x + v.x * 4;
        const cy = head.y + v.y * 4;
        // Eyes sit side by side, perpendicular to the heading.
        const px = -v.y * 6;
        const py = v.x * 6;

        g.fillStyle(COLORS.board, 1);
        g.fillCircle(cx + px, cy + py, 3);
        g.fillCircle(cx - px, cy - py, 3);
    }

    private renderFood(): void {
        const g = this.foodGfx;
        const food = this.logic.food;
        g.clear();

        if (!food || this.phase === "over") {
            return;
        }

        if (food !== this.lastFood) {
            this.lastFood = food;
            this.foodSpawnedAt = this.time.now;
        }

        const now = this.time.now;
        const spawn = Phaser.Math.Easing.Back.Out(Math.min(1, (now - this.foodSpawnedAt) / 280));
        const pulse = 1 + Math.sin(now / 140) * 0.08;
        const x = cellX(food.x);
        const y = cellY(food.y);
        const radius = CELL * 0.3 * spawn * pulse;

        // Expanding ring loop.
        const ring = (now % 900) / 900;
        g.lineStyle(2, COLORS.magenta, (1 - ring) * 0.8);
        g.strokeCircle(x, y, radius + ring * CELL * 0.5);

        g.fillStyle(COLORS.magenta, 1);
        g.fillCircle(x, y, radius);
        g.fillStyle(COLORS.white, 0.9);
        g.fillCircle(x - radius * 0.3, y - radius * 0.3, radius * 0.3);
    }

    // ---------------------------------------------------------------- HUD

    private createHud(): void {
        const labelY = 44;
        const valueY = 82;
        const label = { size: 13, color: CSS.dim, glow: 0, weight: 400 } as const;

        // Small glow on numbers: big blur turns digits into blobs under the bloom.
        neonText(this, BOARD_X, labelY, t("score"), { ...label, align: "left" });
        this.scoreText = neonText(this, BOARD_X, valueY, "0", {
            size: 34,
            color: CSS.cyan,
            weight: 500,
            glow: 5,
            align: "left",
        });

        neonText(this, WIDTH / 2, labelY, t("time"), label);
        this.timeText = neonText(this, WIDTH / 2, valueY, "00:00", { size: 28, color: CSS.white, weight: 400, glow: 0 });

        const bestX = BOARD_X + BOARD_W - 64;
        neonText(this, bestX, labelY, t("best"), { ...label, align: "right" });
        this.bestText = neonText(this, bestX, valueY, String(this.best), {
            size: 28,
            color: CSS.yellow,
            weight: 500,
            glow: 5,
            align: "right",
        });

        // Pause button, needed on touch screens without an ESC key.
        const pauseButton = neonText(this, BOARD_X + BOARD_W - 18, 64, "II", { size: 30, color: CSS.cyan, weight: 900 });
        pauseButton.setInteractive({ useHandCursor: true });
        pauseButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.pause());

        const footerY = BOARD_Y + BOARD_H + 32;
        const tag = `${modeLabel(this.settings.mode)}  ·  ${difficultyLabel(this.settings.difficulty)}`;
        neonText(this, BOARD_X, footerY, tag, { size: 14, color: CSS.purple, glow: 6, align: "left" });
        this.speedText = neonText(this, BOARD_X + BOARD_W, footerY, "", {
            size: 14,
            color: CSS.purple,
            glow: 6,
            align: "right",
        });
    }

    private updateHud(): void {
        this.scoreText.setText(String(this.logic.score));
        const best = Math.max(this.best, this.logic.score);
        this.bestText.setText(String(best));

        const seconds = Math.floor(this.elapsedMs / 1000);
        const pad = (n: number) => n.toString().padStart(2, "0");
        this.timeText.setText(`${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`);

        const { difficulty } = this.settings;
        const multiplier = ticksPerSecond(difficulty, this.logic.foodsEaten) / SPEED_CURVES[difficulty].start;
        this.speedText.setText(`${t("speed")}  x${multiplier.toFixed(2)}`);
    }
}
