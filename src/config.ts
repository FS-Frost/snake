const BASE_HEIGHT = 860;

/**
 * Touch device held in portrait: the canvas gets taller and the extra strip below the board
 * hosts the touch controls instead of covering the board. Evaluated once at startup.
 */
export const TOUCH_LAYOUT =
    (window.matchMedia?.("(pointer: coarse)").matches ?? false) && window.innerHeight > window.innerWidth;

/** Logical resolution. The Scale Manager fits it to the screen with letterbox. */
export const WIDTH = 720;
/** On portrait phones, match the screen aspect so there are no letterbox bars. */
export const HEIGHT = TOUCH_LAYOUT
    ? Math.round(Math.min(1600, Math.max(1100, (WIDTH * window.innerHeight) / window.innerWidth)))
    : BASE_HEIGHT;
/** Vertical center of the touch control strip (only meaningful with TOUCH_LAYOUT). */
export const CONTROLS_Y = BASE_HEIGHT + (HEIGHT - BASE_HEIGHT) / 2;

export const GRID_COLS = 24;
export const GRID_ROWS = 24;
export const CELL = 28;

export const BOARD_X = (WIDTH - GRID_COLS * CELL) / 2;
export const BOARD_Y = 128;
export const BOARD_W = GRID_COLS * CELL;
export const BOARD_H = GRID_ROWS * CELL;

export const FONT = "Orbitron, 'Segoe UI', system-ui, sans-serif";

export const COLORS = {
    bgTop: 0x05040f,
    bgBottom: 0x1b0838,
    board: 0x0a0820,
    grid: 0x2a1b5c,
    cyan: 0x00f0ff,
    magenta: 0xff2a6d,
    yellow: 0xfff275,
    purple: 0x9d4edd,
    white: 0xf4f1ff,
    dim: 0x8f84c4,
} as const;

export const CSS = {
    cyan: "#00f0ff",
    magenta: "#ff2a6d",
    yellow: "#fff275",
    purple: "#9d4edd",
    white: "#f4f1ff",
    dim: "#8f84c4",
} as const;

export const SCENES = {
    boot: "Boot",
    menu: "Menu",
    game: "Game",
    pause: "Pause",
    gameOver: "GameOver",
    settings: "Settings",
} as const;
