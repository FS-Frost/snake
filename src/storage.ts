import type { Difficulty, Mode } from "./core/types";

const KEY = "snake.v2";

interface SaveData {
    highScores: Record<string, number>;
    lastMode: Mode;
    lastDifficulty: Difficulty;
}

const defaults: SaveData = {
    highScores: {},
    lastMode: "wrap",
    lastDifficulty: "normal",
};

// localStorage can be missing or throw (private mode, blocked storage): the game must still run.
function load(): SaveData {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch {
        return { ...defaults };
    }
}

let data = load();

function save(): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
        // Keep in-memory values only.
    }
}

function scoreKey(mode: Mode, difficulty: Difficulty): string {
    return `${mode}:${difficulty}`;
}

export function getHighScore(mode: Mode, difficulty: Difficulty): number {
    return data.highScores[scoreKey(mode, difficulty)] ?? 0;
}

/** Returns true when `score` beats the stored record. */
export function submitScore(mode: Mode, difficulty: Difficulty, score: number): boolean {
    if (score <= getHighScore(mode, difficulty)) {
        return false;
    }

    data.highScores[scoreKey(mode, difficulty)] = score;
    save();
    return true;
}

export function getLastSelection(): { mode: Mode; difficulty: Difficulty } {
    return { mode: data.lastMode, difficulty: data.lastDifficulty };
}

export function setLastSelection(mode: Mode, difficulty: Difficulty): void {
    data = { ...data, lastMode: mode, lastDifficulty: difficulty };
    save();
}
