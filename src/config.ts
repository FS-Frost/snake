import { getSettings } from "./storage";

export const GRID_COLS = 24;
export const GRID_ROWS = 24;
export const CELL = 28;
export const BOARD_W = GRID_COLS * CELL;
export const BOARD_H = GRID_ROWS * CELL;

/**
 * desktop: fixed 720x860, HUD above the board.
 * portrait: touch device held upright; taller canvas matching the screen, controls below the board.
 * landscape: touch device held sideways; board at full height between a HUD column and a controls column.
 */
export type LayoutKind = "desktop" | "portrait" | "landscape";

const DESKTOP_HEIGHT = 860;
const LANDSCAPE_HEIGHT = 760;

// Live bindings: applyLayout() reassigns them and every importer sees the new values.
// Scenes read them in create(), so a relayout is a scene restart.
export let LAYOUT: LayoutKind = "desktop";
/** Logical resolution. The Scale Manager fits it to the screen. */
export let WIDTH = 720;
export let HEIGHT = DESKTOP_HEIGHT;
export let BOARD_X = (WIDTH - BOARD_W) / 2;
export let BOARD_Y = 128;
/** Center of the touch controls (portrait strip or landscape column). */
export let CONTROLS_X = WIDTH / 2;
export let CONTROLS_Y = DESKTOP_HEIGHT;
/** Center x and width of the landscape HUD column. */
export let HUD_X = 0;
export let SIDE_W = 0;
/**
 * Canvas pixels per logical pixel. The canvas is rendered at the screen's physical resolution and each
 * scene camera zooms by this factor, so logical coordinates stay the same while text and shapes stay sharp
 * instead of being stretched (blurred) by CSS.
 */
export let RENDER_SCALE = 1;

/** Upper bound: beyond this the GPU fill rate costs more than the sharpness gains. */
const MAX_RENDER_SCALE = 3;
/** Small windows render below logical size too: CSS downscaling blurs as much as upscaling. */
const MIN_RENDER_SCALE = 0.5;

function computeRenderScale(): number {
    const fit = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    const physical = fit * (window.devicePixelRatio || 1);
    // Two decimals: tiny resize jitter must not trigger a relayout.
    return Math.round(Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, physical)) * 100) / 100;
}

/** Canvas backing size in physical pixels. */
export function canvasSize(): { width: number; height: number } {
    return { width: Math.round(WIDTH * RENDER_SCALE), height: Math.round(HEIGHT * RENDER_SCALE) };
}

export function detectLayout(): LayoutKind {
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!touch) {
        return "desktop";
    }
    return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

/** Recomputes every layout value for the current viewport. Returns true when anything changed. */
export function applyLayout(): boolean {
    const before = `${LAYOUT}:${WIDTH}x${HEIGHT}:${BOARD_X}:${HUD_X}:${RENDER_SCALE}`;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    LAYOUT = detectLayout();

    if (LAYOUT === "landscape") {
        HEIGHT = LANDSCAPE_HEIGHT;
        WIDTH = Math.round(Math.min(1800, Math.max(1100, HEIGHT * aspect)));
        BOARD_X = Math.round((WIDTH - BOARD_W) / 2);
        BOARD_Y = Math.round((HEIGHT - BOARD_H) / 2);
        SIDE_W = BOARD_X;
        // Controls go on the thumb side chosen in settings; the HUD takes the other column.
        const controlsLeft = getSettings().dpadSide === "left";
        const left = SIDE_W / 2;
        const right = BOARD_X + BOARD_W + SIDE_W / 2;
        CONTROLS_X = controlsLeft ? left : right;
        HUD_X = controlsLeft ? right : left;
        CONTROLS_Y = HEIGHT / 2 + 40;
    } else {
        WIDTH = 720;
        HEIGHT =
            LAYOUT === "portrait"
                ? Math.round(Math.min(1600, Math.max(1100, WIDTH / aspect)))
                : DESKTOP_HEIGHT;
        BOARD_X = (WIDTH - BOARD_W) / 2;
        BOARD_Y = 128;
        SIDE_W = 0;
        HUD_X = 0;
        CONTROLS_X = WIDTH / 2;
        CONTROLS_Y = DESKTOP_HEIGHT + (HEIGHT - DESKTOP_HEIGHT) / 2;
    }

    RENDER_SCALE = computeRenderScale();
    return before !== `${LAYOUT}:${WIDTH}x${HEIGHT}:${BOARD_X}:${HUD_X}:${RENDER_SCALE}`;
}

applyLayout();

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
    orange: 0xff8c42,
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
    message: "Message",
    fonoteca: "Fonoteca",
} as const;
