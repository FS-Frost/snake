import type { Difficulty } from "./types";

interface SpeedCurve {
    /** Ticks per second at the start. */
    start: number;
    /** Ticks per second the curve approaches. */
    max: number;
    /** Points per food. */
    points: number;
}

export const SPEED_CURVES: Record<Difficulty, SpeedCurve> = {
    easy: { start: 6, max: 13, points: 10 },
    normal: { start: 8, max: 18, points: 20 },
    hard: { start: 10, max: 24, points: 30 },
};

/** How many foods it takes to cover ~63% of the gap between start and max speed. */
const ACCELERATION_FOODS = 15;

/**
 * Speed grows fast early and flattens later, so it never becomes unplayable.
 */
export function ticksPerSecond(difficulty: Difficulty, foodsEaten: number): number {
    const { start, max } = SPEED_CURVES[difficulty];
    return start + (max - start) * (1 - Math.exp(-foodsEaten / ACCELERATION_FOODS));
}

export function tickMs(difficulty: Difficulty, foodsEaten: number): number {
    return 1000 / ticksPerSecond(difficulty, foodsEaten);
}
