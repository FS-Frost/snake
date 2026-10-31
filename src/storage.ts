import type { Difficulty, Mode } from "./core/types";
import type { Language } from "./i18n";

const KEY = "snake.v2";

export type TouchScheme = "swipe" | "dpad";

export interface Settings {
    /** 0-10. */
    music: number;
    /** 0-10. */
    sfx: number;
    bloom: boolean;
    shake: boolean;
    flash: boolean;
    touch: TouchScheme;
    language: Language;
}

interface SaveData {
    highScores: Record<string, number>;
    lastMode: Mode;
    lastDifficulty: Difficulty;
    settings: Settings;
}

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const defaultSettings: Settings = {
    music: 6,
    sfx: 8,
    bloom: true,
    // Respect the OS accessibility setting until the player chooses otherwise.
    shake: !reducedMotion,
    flash: !reducedMotion,
    touch: "swipe",
    language: navigator.language.toLowerCase().startsWith("es") ? "es" : "en",
};

const defaults: SaveData = {
    highScores: {},
    lastMode: "wrap",
    lastDifficulty: "normal",
    settings: defaultSettings,
};

// localStorage can be missing or throw (private mode, blocked storage): the game must still run.
function load(): SaveData {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) {
            return { ...defaults };
        }

        const parsed = JSON.parse(raw) as Partial<SaveData>;
        // Nested merge so settings added in later versions get their defaults.
        return { ...defaults, ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
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

export function getSettings(): Readonly<Settings> {
    return data.settings;
}

export function updateSettings(patch: Partial<Settings>): void {
    data = { ...data, settings: { ...data.settings, ...patch } };
    save();
}
