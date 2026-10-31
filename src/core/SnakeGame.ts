import { SPEED_CURVES, tickMs } from "./difficulty";
import {
    type Cell,
    type Difficulty,
    type Direction,
    DIRECTION_VECTORS,
    type Mode,
    OPPOSITE,
    sameCell,
} from "./types";

export interface SnakeGameOptions {
    cols: number;
    rows: number;
    mode: Mode;
    difficulty: Difficulty;
    initialLength?: number;
    /** Returns a float in [0, 1). Injectable for deterministic tests. */
    random?: () => number;
}

export type GameStatus = "playing" | "dead" | "won";

export interface StepResult {
    ate: boolean;
    died: boolean;
    won: boolean;
    /** True when the head crossed an edge in wrap mode (renderer must not interpolate across the board). */
    wrapped: boolean;
}

/** Max directions buffered between ticks, so quick turns are not lost. */
const MAX_QUEUED_TURNS = 3;

/**
 * Pure Snake rules. No rendering, no timing: the caller decides when to call step().
 */
export class SnakeGame {
    readonly cols: number;
    readonly rows: number;
    readonly mode: Mode;
    readonly difficulty: Difficulty;

    /** Head first. */
    snake: Cell[] = [];
    /** Snapshot of `snake` before the last step, for render interpolation. */
    previousSnake: Cell[] = [];
    food: Cell | null = null;
    direction: Direction = "right";
    status: GameStatus = "playing";
    score = 0;
    foodsEaten = 0;

    private turnQueue: Direction[] = [];
    private pendingGrowth = 0;
    private readonly random: () => number;

    constructor(options: SnakeGameOptions) {
        this.cols = options.cols;
        this.rows = options.rows;
        this.mode = options.mode;
        this.difficulty = options.difficulty;
        this.random = options.random ?? Math.random;

        const length = options.initialLength ?? 3;
        const headX = Math.floor(this.cols / 2);
        const headY = Math.floor(this.rows / 2);

        for (let i = 0; i < length; i++) {
            this.snake.push({ x: headX - i, y: headY });
        }

        this.previousSnake = this.cloneSnake();
        this.spawnFood();
    }

    get head(): Cell {
        return this.snake[0];
    }

    get tickMs(): number {
        return tickMs(this.difficulty, this.foodsEaten);
    }

    /**
     * Buffers a turn. Validated against the last queued direction, not the current one,
     * so "right, up, left" within one tick works instead of being rejected as a U-turn.
     */
    queueTurn(direction: Direction): void {
        if (this.status !== "playing") {
            return;
        }

        const last = this.turnQueue.at(-1) ?? this.direction;

        if (direction === last || direction === OPPOSITE[last]) {
            return;
        }

        if (this.turnQueue.length >= MAX_QUEUED_TURNS) {
            return;
        }

        this.turnQueue.push(direction);
    }

    step(): StepResult {
        const result: StepResult = { ate: false, died: false, won: false, wrapped: false };

        if (this.status !== "playing") {
            return result;
        }

        this.previousSnake = this.cloneSnake();
        this.direction = this.turnQueue.shift() ?? this.direction;

        const vector = DIRECTION_VECTORS[this.direction];
        let next: Cell = { x: this.head.x + vector.x, y: this.head.y + vector.y };

        if (!this.isInside(next)) {
            if (this.mode === "classic") {
                return this.die(result);
            }

            next = {
                x: (next.x + this.cols) % this.cols,
                y: (next.y + this.rows) % this.rows,
            };
            result.wrapped = true;
        }

        // The tail moves away this tick unless the snake is growing, so it is a legal target.
        const body = this.pendingGrowth > 0 ? this.snake : this.snake.slice(0, -1);

        if (body.some((cell) => sameCell(cell, next))) {
            return this.die(result);
        }

        this.snake.unshift(next);

        if (this.pendingGrowth > 0) {
            this.pendingGrowth--;
        } else {
            this.snake.pop();
        }

        if (this.food && sameCell(next, this.food)) {
            result.ate = true;
            this.foodsEaten++;
            this.score += SPEED_CURVES[this.difficulty].points;
            // Grows on the next tick: the tail stays one extra step.
            this.pendingGrowth++;

            if (this.snake.length + this.pendingGrowth >= this.cols * this.rows) {
                this.food = null;
                this.status = "won";
                result.won = true;
            } else {
                this.spawnFood();
            }
        }

        return result;
    }

    isInside(cell: Cell): boolean {
        return cell.x >= 0 && cell.x < this.cols && cell.y >= 0 && cell.y < this.rows;
    }

    /** Picks uniformly among free cells. Never loops, never throws. */
    private spawnFood(): void {
        const occupied = new Set(this.snake.map((cell) => cell.y * this.cols + cell.x));
        const free: Cell[] = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (!occupied.has(y * this.cols + x)) {
                    free.push({ x, y });
                }
            }
        }

        this.food = free.length > 0 ? free[Math.floor(this.random() * free.length)] : null;
    }

    private die(result: StepResult): StepResult {
        this.status = "dead";
        this.turnQueue = [];
        result.died = true;
        return result;
    }

    private cloneSnake(): Cell[] {
        return this.snake.map((cell) => ({ ...cell }));
    }
}
