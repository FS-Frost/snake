import { describe, expect, test } from "bun:test";
import { RULES, SnakeGame } from "../src/core/SnakeGame";
import { ticksPerSecond } from "../src/core/difficulty";

function makeGame(mode: "classic" | "wrap" = "wrap") {
    // random() = 0 always places food on the first free cell (top-left area).
    return new SnakeGame({ cols: 10, rows: 10, mode, difficulty: "normal", random: () => 0 });
}

describe("SnakeGame", () => {
    test("starts centered, heading right, length 3", () => {
        const game = makeGame();
        expect(game.snake).toEqual([
            { x: 5, y: 5 },
            { x: 4, y: 5 },
            { x: 3, y: 5 },
        ]);
        expect(game.direction).toBe("right");
    });

    test("food never spawns on the snake and can use row/column 0", () => {
        const game = makeGame();
        expect(game.food).toEqual({ x: 0, y: 0 });
    });

    test("buffers quick turns instead of dropping them", () => {
        const game = makeGame();
        game.queueTurn("up");
        game.queueTurn("left");
        game.step();
        expect(game.head).toEqual({ x: 5, y: 4 });
        game.step();
        expect(game.head).toEqual({ x: 4, y: 4 });
    });

    test("rejects U-turns against the last queued direction", () => {
        const game = makeGame();
        game.queueTurn("left");
        game.step();
        expect(game.head).toEqual({ x: 6, y: 5 });
    });

    test("wraps through edges in wrap mode", () => {
        const game = makeGame("wrap");
        let wrapped = false;
        for (let i = 0; i < 5; i++) wrapped = game.step().wrapped || wrapped;
        expect(wrapped).toBe(true);
        expect(game.head).toEqual({ x: 0, y: 5 });
        expect(game.status).toBe("playing");
    });

    test("dies on walls in classic mode", () => {
        const game = makeGame("classic");
        let died = false;
        for (let i = 0; i < 5; i++) died = game.step().died || died;
        expect(died).toBe(true);
        expect(game.status).toBe("dead");
    });

    test("self-collision is checked after wrapping", () => {
        const game = new SnakeGame({ cols: 4, rows: 4, mode: "wrap", difficulty: "normal", random: () => 0 });
        game.snake = [
            { x: 3, y: 1 },
            { x: 3, y: 2 },
            { x: 0, y: 2 },
            { x: 0, y: 1 },
            { x: 0, y: 0 },
        ];
        game.direction = "right";
        // Next head wraps to (0,1), which is body (not tail): must die.
        expect(game.step().died).toBe(true);
    });

    test("moving into the tail cell is legal when not growing", () => {
        const game = makeGame();
        game.snake = [
            { x: 5, y: 5 },
            { x: 5, y: 6 },
            { x: 6, y: 6 },
            { x: 6, y: 5 },
        ];
        game.direction = "right";
        expect(game.step().died).toBe(false);
        expect(game.head).toEqual({ x: 6, y: 5 });
    });

    test("eating scores, grows one segment next tick and respawns food", () => {
        const game = makeGame();
        game.food = { x: 6, y: 5 };
        const result = game.step();
        expect(result.ate).toBe(true);
        expect(game.score).toBe(20);
        expect(game.snake.length).toBe(3);
        game.step();
        expect(game.snake.length).toBe(4);
        expect(game.food).not.toBeNull();
    });

    test("wins when no free cell remains", () => {
        const game = new SnakeGame({ cols: 2, rows: 1, mode: "wrap", difficulty: "easy", initialLength: 1, random: () => 0 });
        game.snake = [{ x: 0, y: 0 }];
        game.food = { x: 1, y: 0 };
        const result = game.step();
        expect(result.won).toBe(true);
        expect(game.status).toBe("won");
    });
});

describe("difficulty curve", () => {
    test("starts at the base speed and approaches but never exceeds the max", () => {
        expect(ticksPerSecond("normal", 0)).toBe(8);
        expect(ticksPerSecond("normal", 1000)).toBeLessThanOrEqual(18);
        expect(ticksPerSecond("normal", 30)).toBeGreaterThan(ticksPerSecond("normal", 10));
    });
});

describe("power-ups and combo", () => {
    function playing() {
        return new SnakeGame({ cols: 24, rows: 24, mode: "wrap", difficulty: "normal", random: () => 0 });
    }

    function feedAhead(game: SnakeGame) {
        game.food = { x: game.head.x + 1, y: game.head.y };
        return game.step();
    }

    test("combo multiplies points inside the window and resets after it", () => {
        const game = playing();
        expect(feedAhead(game).points).toBe(20);
        game.advance(1000);
        expect(feedAhead(game).points).toBe(40);
        expect(game.combo).toBe(2);
        game.advance(RULES.comboWindowMs + 1);
        expect(game.combo).toBe(1);
        expect(feedAhead(game).points).toBe(20);
    });

    test("combo caps at the max", () => {
        const game = playing();
        for (let i = 0; i < 8; i++) feedAhead(game);
        expect(game.combo).toBe(RULES.maxCombo);
    });

    test("a special item spawns after the configured number of foods and expires", () => {
        const game = playing();
        let spawned = false;
        for (let i = 0; i < RULES.itemEvery[0]; i++) spawned = feedAhead(game).itemSpawned || spawned;
        expect(spawned).toBe(true);
        expect(game.item).not.toBeNull();
        const expired = game.advance(RULES.itemLifetimeMs);
        expect(expired.itemExpired).not.toBeNull();
        expect(game.item).toBeNull();
    });

    test("slow-mo stretches the tick and ends after its duration", () => {
        const game = playing();
        const normal = game.tickMs;
        game.item = { type: "slowmo", cell: { x: game.head.x + 1, y: game.head.y }, expiresAt: 99999 };
        expect(game.step().picked).toBe("slowmo");
        expect(game.tickMs).toBeCloseTo(normal * RULES.slowmoFactor);
        const result = game.advance(RULES.effectMs);
        expect(result.effectsEnded).toEqual(["slowmo"]);
        expect(game.tickMs).toBeCloseTo(normal);
    });

    test("ghost passes through the body but not obstacles", () => {
        const game = playing();
        game.effects.ghost = game.clock + 5000;
        game.snake = [
            { x: 5, y: 5 },
            { x: 5, y: 6 },
            { x: 6, y: 6 },
            { x: 6, y: 5 },
            { x: 7, y: 5 },
        ];
        game.direction = "right";
        expect(game.step().died).toBe(false);

        game.obstacles = [{ x: 7, y: 5 }];
        expect(game.step().died).toBe(true);
    });

    test("scissors cut a third of the snake, never below the minimum", () => {
        const game = playing();
        game.snake = Array.from({ length: 12 }, (_, i) => ({ x: 20 - i, y: 3 }));
        game.direction = "right";
        game.item = { type: "scissors", cell: { x: 21, y: 3 }, expiresAt: 99999 };
        const result = game.step();
        expect(game.snake.length).toBe(8);
        expect(result.cut.length).toBe(4);
    });

    test("golden food gives the golden multiplier and grows", () => {
        const game = playing();
        game.item = { type: "golden", cell: { x: game.head.x + 1, y: game.head.y }, expiresAt: 99999 };
        const result = game.step();
        expect(result.points).toBe(20 * RULES.goldenMultiplier);
        game.step();
        expect(game.snake.length).toBe(4);
    });

    test("new level adds obstacles away from the head and its path", () => {
        const game = new SnakeGame({ cols: 24, rows: 24, mode: "wrap", difficulty: "normal" });
        let added: { x: number; y: number }[] = [];
        for (let i = 0; i < RULES.foodsPerLevel; i++) {
            const result = feedAhead(game);
            if (result.obstaclesAdded.length) added = result.obstaclesAdded;
        }
        expect(game.level).toBe(2);
        expect(added.length).toBeGreaterThan(0);
        for (const cell of added) {
            const distance = Math.abs(cell.x - game.head.x) + Math.abs(cell.y - game.head.y);
            expect(distance).toBeGreaterThan(RULES.obstacleSafeRadius);
            const inPath = cell.y === game.head.y && (cell.x - game.head.x + 24) % 24 <= RULES.obstacleSafeAhead;
            expect(inPath).toBe(false);
            expect(game.snake.some((s) => s.x === cell.x && s.y === cell.y)).toBe(false);
        }
    });

    test("timers do not move while not advanced (pause)", () => {
        const game = playing();
        game.effects.ghost = game.clock + RULES.effectMs;
        for (let i = 0; i < 50; i++) game.step();
        expect(game.isActive("ghost")).toBe(true);
    });
});
