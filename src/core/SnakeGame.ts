import { SPEED_CURVES, tickMs } from "./difficulty";
import {
    type Cell,
    type Difficulty,
    type Direction,
    DIRECTION_VECTORS,
    type EffectType,
    ITEM_TYPES,
    type ItemType,
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

export interface Item {
    type: ItemType;
    cell: Cell;
    /** Game clock time (ms) when it disappears. */
    expiresAt: number;
}

export interface StepResult {
    /** Regular food eaten. */
    ate: boolean;
    /** Special item picked up this tick. */
    picked: ItemType | null;
    /** Points earned this tick (already multiplied). */
    points: number;
    /** Tail segments removed by scissors, for the cut effect. */
    cut: Cell[];
    /** Obstacles added because a new level started. */
    obstaclesAdded: Cell[];
    /** A special item appeared this tick. */
    itemSpawned: boolean;
    died: boolean;
    won: boolean;
    /** True when the head crossed an edge in wrap mode (renderer must not interpolate across the board). */
    wrapped: boolean;
}

export interface AdvanceResult {
    itemExpired: Cell | null;
    effectsEnded: EffectType[];
}

/** Max directions buffered between ticks, so quick turns are not lost. */
const MAX_QUEUED_TURNS = 3;

export const RULES = {
    effectMs: 5000,
    itemLifetimeMs: 7000,
    /** A special item spawns after this many regular foods (inclusive range). */
    itemEvery: [5, 8] as const,
    comboWindowMs: 3000,
    maxCombo: 5,
    goldenMultiplier: 5,
    slowmoFactor: 1.6,
    /** Scissors need a long enough snake to make sense. */
    scissorsMinLength: 9,
    minLength: 3,
    foodsPerLevel: 10,
    obstaclePiecesPerLevel: 2,
    maxObstacleCells: 40,
    /** No obstacle within this Manhattan distance of the head. */
    obstacleSafeRadius: 3,
    /** No obstacle on the next N cells in front of the head. */
    obstacleSafeAhead: 8,
} as const;

/** Obstacle shapes as offsets: single block, two-long bars, L. */
const OBSTACLE_SHAPES: readonly Cell[][] = [
    [{ x: 0, y: 0 }],
    [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
    ],
    [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
    ],
    [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
    ],
];

/**
 * Pure Snake rules. No rendering and no real time: the caller calls step() once per tick
 * and advance(ms) with the elapsed play time, so timers freeze while paused.
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
    item: Item | null = null;
    obstacles: Cell[] = [];
    direction: Direction = "right";
    status: GameStatus = "playing";
    score = 0;
    /** Regular and golden food: drives speed and level. */
    foodsEaten = 0;
    combo = 1;
    /** Game clock in ms of play time. */
    clock = 0;
    /** Effect end times on the game clock. */
    effects: Partial<Record<EffectType, number>> = {};

    private turnQueue: Direction[] = [];
    private pendingGrowth = 0;
    private lastPickupAt = Number.NEGATIVE_INFINITY;
    private foodsUntilItem: number;
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
        this.foodsUntilItem = this.rollItemInterval();
        this.food = this.randomFreeCell();
    }

    get head(): Cell {
        return this.snake[0];
    }

    get level(): number {
        return 1 + Math.floor(this.foodsEaten / RULES.foodsPerLevel);
    }

    get tickMs(): number {
        const base = tickMs(this.difficulty, this.foodsEaten);
        return this.isActive("slowmo") ? base * RULES.slowmoFactor : base;
    }

    isActive(effect: EffectType): boolean {
        return (this.effects[effect] ?? 0) > this.clock;
    }

    /** 0..1 of the effect time left. */
    effectRemaining(effect: EffectType): number {
        return Math.max(0, ((this.effects[effect] ?? 0) - this.clock) / RULES.effectMs);
    }

    /** 0..1 of the combo window left; 0 when no combo is running. */
    comboRemaining(): number {
        if (this.combo <= 1) {
            return 0;
        }

        return Math.max(0, 1 - (this.clock - this.lastPickupAt) / RULES.comboWindowMs);
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

    /** Moves the game clock: expires the item, ends effects and the combo window. */
    advance(ms: number): AdvanceResult {
        const result: AdvanceResult = { itemExpired: null, effectsEnded: [] };

        if (this.status !== "playing") {
            return result;
        }

        const before = this.clock;
        this.clock += ms;

        if (this.item && this.item.expiresAt <= this.clock) {
            result.itemExpired = this.item.cell;
            this.item = null;
        }

        for (const effect of Object.keys(this.effects) as EffectType[]) {
            const end = this.effects[effect]!;
            if (end > before && end <= this.clock) {
                result.effectsEnded.push(effect);
            }
        }

        if (this.clock - this.lastPickupAt > RULES.comboWindowMs) {
            this.combo = 1;
        }

        return result;
    }

    step(): StepResult {
        const result: StepResult = {
            ate: false,
            picked: null,
            points: 0,
            cut: [],
            obstaclesAdded: [],
            itemSpawned: false,
            died: false,
            won: false,
            wrapped: false,
        };

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

        if (this.obstacles.some((cell) => sameCell(cell, next))) {
            return this.die(result);
        }

        // The tail moves away this tick unless the snake is growing, so it is a legal target.
        // Ghost lets the head pass through the body.
        const body = this.pendingGrowth > 0 ? this.snake : this.snake.slice(0, -1);

        if (!this.isActive("ghost") && body.some((cell) => sameCell(cell, next))) {
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
            this.eatGrowing(result, 1);
            this.food = null;

            if (!this.checkWin(result)) {
                this.food = this.randomFreeCell();
                this.maybeSpawnItem(result);
            }
        } else if (this.item && sameCell(next, this.item.cell)) {
            this.pickItem(result, this.item.type);
        }

        return result;
    }

    isInside(cell: Cell): boolean {
        return cell.x >= 0 && cell.x < this.cols && cell.y >= 0 && cell.y < this.rows;
    }

    // ------------------------------------------------------------------ pickups

    /** Regular and golden food: score, combo, growth, level-ups. */
    private eatGrowing(result: StepResult, multiplier: number): void {
        const levelBefore = this.level;
        this.foodsEaten++;
        this.addPoints(result, multiplier);
        // Grows on the next tick: the tail stays one extra step.
        this.pendingGrowth++;

        if (this.level > levelBefore) {
            result.obstaclesAdded = this.addObstacles();
        }
    }

    private pickItem(result: StepResult, type: ItemType): void {
        result.picked = type;
        this.item = null;

        switch (type) {
            case "golden":
                this.eatGrowing(result, RULES.goldenMultiplier);
                this.checkWin(result);
                break;
            case "slowmo":
            case "ghost":
                this.addPoints(result, 1);
                this.effects[type] = this.clock + RULES.effectMs;
                break;
            case "scissors": {
                this.addPoints(result, 1);
                const keep = Math.max(RULES.minLength, this.snake.length - Math.floor(this.snake.length / 3));
                result.cut = this.snake.splice(keep);
                this.pendingGrowth = 0;
                break;
            }
        }
    }

    /** Every pickup inside the combo window raises the multiplier. */
    private addPoints(result: StepResult, multiplier: number): void {
        const inWindow = this.clock - this.lastPickupAt <= RULES.comboWindowMs;
        this.combo = inWindow ? Math.min(RULES.maxCombo, this.combo + 1) : 1;
        this.lastPickupAt = this.clock;

        const points = SPEED_CURVES[this.difficulty].points * multiplier * this.combo;
        this.score += points;
        result.points += points;
    }

    private maybeSpawnItem(result: StepResult): void {
        this.foodsUntilItem--;

        if (this.foodsUntilItem > 0 || this.item) {
            return;
        }

        this.foodsUntilItem = this.rollItemInterval();
        const allowed = ITEM_TYPES.filter((type) => type !== "scissors" || this.snake.length >= RULES.scissorsMinLength);
        const cell = this.randomFreeCell();

        if (!cell) {
            return;
        }

        this.item = {
            type: allowed[Math.floor(this.random() * allowed.length)],
            cell,
            expiresAt: this.clock + RULES.itemLifetimeMs,
        };
        result.itemSpawned = true;
    }

    private rollItemInterval(): number {
        const [min, max] = RULES.itemEvery;
        return min + Math.floor(this.random() * (max - min + 1));
    }

    // ------------------------------------------------------------------ board

    private addObstacles(): Cell[] {
        const added: Cell[] = [];
        const blocked = this.unsafeForObstacles();

        for (let piece = 0; piece < RULES.obstaclePiecesPerLevel; piece++) {
            if (this.obstacles.length + 3 > RULES.maxObstacleCells) {
                break;
            }

            const shape = OBSTACLE_SHAPES[Math.floor(this.random() * OBSTACLE_SHAPES.length)];
            const candidates = this.freeCells().filter((origin) =>
                shape.every((offset) => {
                    const cell = { x: origin.x + offset.x, y: origin.y + offset.y };
                    return this.isInside(cell) && !blocked.has(this.key(cell));
                }),
            );

            if (candidates.length === 0) {
                continue;
            }

            const origin = candidates[Math.floor(this.random() * candidates.length)];
            for (const offset of shape) {
                const cell = { x: origin.x + offset.x, y: origin.y + offset.y };
                this.obstacles.push(cell);
                added.push(cell);
                blocked.add(this.key(cell));
            }
        }

        return added;
    }

    /** Cells where an obstacle would be unfair: occupied, near the head or in its path. */
    private unsafeForObstacles(): Set<number> {
        const blocked = new Set<number>();
        const occupied = [...this.snake, ...this.obstacles];
        if (this.food) occupied.push(this.food);
        if (this.item) occupied.push(this.item.cell);
        occupied.forEach((cell) => blocked.add(this.key(cell)));

        const head = this.head;
        const radius = RULES.obstacleSafeRadius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) + Math.abs(dy) <= radius) {
                    blocked.add(this.key(this.wrapCell({ x: head.x + dx, y: head.y + dy })));
                }
            }
        }

        const v = DIRECTION_VECTORS[this.direction];
        for (let i = 1; i <= RULES.obstacleSafeAhead; i++) {
            blocked.add(this.key(this.wrapCell({ x: head.x + v.x * i, y: head.y + v.y * i })));
        }

        return blocked;
    }

    private checkWin(result: StepResult): boolean {
        const capacity = this.cols * this.rows - this.obstacles.length;

        if (this.snake.length + this.pendingGrowth < capacity) {
            return false;
        }

        this.food = null;
        this.item = null;
        this.status = "won";
        result.won = true;
        return true;
    }

    private freeCells(): Cell[] {
        const occupied = new Set<number>();
        for (const cell of this.snake) occupied.add(this.key(cell));
        for (const cell of this.obstacles) occupied.add(this.key(cell));
        if (this.food) occupied.add(this.key(this.food));
        if (this.item) occupied.add(this.key(this.item.cell));

        const free: Cell[] = [];
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (!occupied.has(y * this.cols + x)) {
                    free.push({ x, y });
                }
            }
        }

        return free;
    }

    /** Picks uniformly among free cells. Never loops, never throws. */
    private randomFreeCell(): Cell | null {
        const free = this.freeCells();
        return free.length > 0 ? free[Math.floor(this.random() * free.length)] : null;
    }

    private wrapCell(cell: Cell): Cell {
        return { x: (cell.x + this.cols) % this.cols, y: (cell.y + this.rows) % this.rows };
    }

    private key(cell: Cell): number {
        return cell.y * this.cols + cell.x;
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
