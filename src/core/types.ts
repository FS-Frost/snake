export interface Cell {
    x: number;
    y: number;
}

export type Direction = "up" | "down" | "left" | "right";

/** classic: walls kill. wrap: the snake goes through edges. */
export type Mode = "classic" | "wrap";

export type Difficulty = "easy" | "normal" | "hard";

export const MODES: readonly Mode[] = ["wrap", "classic"];
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export const DIRECTION_VECTORS: Record<Direction, Cell> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
};

export function sameCell(a: Cell, b: Cell): boolean {
    return a.x === b.x && a.y === b.y;
}
