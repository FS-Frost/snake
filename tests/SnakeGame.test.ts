import { describe, expect, test } from "bun:test";
import { SnakeGame } from "../src/core/SnakeGame";
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
