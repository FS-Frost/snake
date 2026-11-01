import { COLORS } from "./config";
import type { ItemType } from "./core/types";
import { getSettings } from "./storage";

/** neon: synthwave look. The other three are the "Old School" pixel styles. */
export type Style = "neon" | "gameboy" | "nokia" | "console";

export const STYLES: readonly Style[] = ["neon", "gameboy", "nokia", "console"];

/** "surprise" hops between styles during play; it is the default. */
export type StyleSetting = Style | "surprise";

export const STYLE_SETTINGS: readonly StyleSetting[] = ["surprise", ...STYLES];

/** Semantic text colors, so scenes never pick raw colors. */
export type TextRole = "text" | "dim" | "primary" | "secondary" | "highlight" | "danger";

export interface Theme {
    style: Style;
    /** True for the pixel styles: blocky drawing, pixel font, step movement, no glow or bloom. */
    pixel: boolean;
    font: string;
    /** Pixel fonts are much wider; sizes from the scenes are scaled by this. */
    fontScale: number;
    /** Neon glow on text (canvas shadow). */
    glow: boolean;
    text: Record<TextRole, number>;
    /** Full-screen background (pixel styles; neon uses the synthwave backdrop). */
    background: number;
    board: number;
    grid: number;
    snakeHead: number;
    /** Body color near the head and at the tail; interpolated in between. */
    snakeBody: [number, number];
    /** Eyes and other details drawn on top of the snake. */
    snakeDetail: number;
    food: number;
    items: Record<ItemType, number>;
    obstacle: number;
    obstacleDetail: number;
    /** Overlay dim color behind pause, settings and game over. */
    overlay: number;
    overlayAlpha: number;
    /** ADD looks great on dark neon but vanishes on light LCD palettes. */
    particleBlend: number;
}

/** Game Boy DMG greens, darkest to lightest. */
const GB = [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f] as const;
/** Nokia LCD: ink and backlight. */
const NOKIA = { ink: 0x43523d, lcd: 0xc7f0d8 } as const;

// Phaser.BlendModes values, inlined so this module stays importable from tests without Phaser.
const BLEND_NORMAL = 0;
const BLEND_ADD = 1;

const PIXEL_FONT = "'Press Start 2P', monospace";

export const THEMES: Record<Style, Theme> = {
    neon: {
        style: "neon",
        pixel: false,
        font: "Orbitron, 'Segoe UI', system-ui, sans-serif",
        fontScale: 1,
        glow: true,
        text: {
            text: COLORS.white,
            dim: COLORS.dim,
            primary: COLORS.cyan,
            secondary: COLORS.purple,
            highlight: COLORS.yellow,
            danger: COLORS.magenta,
        },
        background: COLORS.bgTop,
        board: COLORS.board,
        grid: COLORS.grid,
        snakeHead: COLORS.white,
        snakeBody: [COLORS.cyan, COLORS.purple],
        snakeDetail: COLORS.board,
        food: COLORS.magenta,
        items: { golden: COLORS.yellow, slowmo: COLORS.cyan, ghost: COLORS.white, scissors: COLORS.orange },
        obstacle: 0x2a0b4a,
        obstacleDetail: COLORS.magenta,
        overlay: 0x05040f,
        overlayAlpha: 0.75,
        particleBlend: BLEND_ADD,
    },
    gameboy: {
        style: "gameboy",
        pixel: true,
        font: PIXEL_FONT,
        fontScale: 0.62,
        glow: false,
        text: { text: GB[0], dim: GB[1], primary: GB[0], secondary: GB[1], highlight: GB[0], danger: GB[0] },
        background: GB[3],
        board: GB[2],
        grid: GB[3],
        snakeHead: GB[0],
        snakeBody: [GB[1], GB[1]],
        snakeDetail: GB[3],
        food: GB[0],
        items: { golden: GB[0], slowmo: GB[0], ghost: GB[1], scissors: GB[0] },
        obstacle: GB[1],
        obstacleDetail: GB[0],
        overlay: GB[3],
        overlayAlpha: 0.88,
        particleBlend: BLEND_NORMAL,
    },
    nokia: {
        style: "nokia",
        pixel: true,
        font: PIXEL_FONT,
        fontScale: 0.62,
        glow: false,
        text: {
            text: NOKIA.ink,
            dim: NOKIA.ink,
            primary: NOKIA.ink,
            secondary: NOKIA.ink,
            highlight: NOKIA.ink,
            danger: NOKIA.ink,
        },
        background: NOKIA.lcd,
        board: NOKIA.lcd,
        grid: NOKIA.lcd,
        snakeHead: NOKIA.ink,
        snakeBody: [NOKIA.ink, NOKIA.ink],
        snakeDetail: NOKIA.lcd,
        food: NOKIA.ink,
        items: { golden: NOKIA.ink, slowmo: NOKIA.ink, ghost: NOKIA.ink, scissors: NOKIA.ink },
        obstacle: NOKIA.ink,
        obstacleDetail: NOKIA.lcd,
        overlay: NOKIA.lcd,
        overlayAlpha: 0.9,
        particleBlend: BLEND_NORMAL,
    },
    console: {
        style: "console",
        pixel: true,
        font: PIXEL_FONT,
        fontScale: 0.62,
        glow: false,
        text: {
            text: 0xfcfcfc,
            dim: 0x7c7c7c,
            primary: 0x3cbcfc,
            secondary: 0x6844fc,
            highlight: 0xf8b800,
            danger: 0xf83800,
        },
        background: 0x000000,
        board: 0x0000a8,
        grid: 0x0000bc,
        snakeHead: 0xb8f818,
        snakeBody: [0x58d854, 0x00a800],
        snakeDetail: 0x000000,
        food: 0xf83800,
        items: { golden: 0xf8b800, slowmo: 0x3cbcfc, ghost: 0xfcfcfc, scissors: 0xf878f8 },
        obstacle: 0xa81000,
        obstacleDetail: 0xe45c10,
        overlay: 0x000000,
        overlayAlpha: 0.9,
        particleBlend: BLEND_NORMAL,
    },
};

const STYLE_LABELS: Record<Style, string> = {
    neon: "NEON",
    gameboy: "GAME BOY",
    nokia: "NOKIA",
    console: "8-BIT",
};

/** Style names are proper names, the same in every language. */
export function styleLabel(style: Style): string {
    return STYLE_LABELS[style];
}

// ------------------------------------------------------------------ surprise mode

/** Foods between surprise switches (inclusive range). */
const SURPRISE_EVERY = [3, 6] as const;

const randomStyle = (except?: Style): Style => {
    const pool = STYLES.filter((style) => style !== except);
    return pool[Math.floor(Math.random() * pool.length)];
};

const rollSurpriseInterval = () =>
    SURPRISE_EVERY[0] + Math.floor(Math.random() * (SURPRISE_EVERY[1] - SURPRISE_EVERY[0] + 1));

/** Session state: which style "surprise" is showing right now, and when it changes next. */
let surpriseStyle: Style = randomStyle();
let foodsUntilSurprise = rollSurpriseInterval();

export function isSurprise(): boolean {
    return getSettings().style === "surprise";
}

/** The concrete style on screen: the chosen one, or the current pick of surprise mode. */
export function activeStyle(): Style {
    const setting = getSettings().style;
    return setting === "surprise" ? surpriseStyle : setting;
}

/** Re-rolls the surprise style (e.g. previewing it in the style picker). */
export function shuffleSurprise(): void {
    surpriseStyle = randomStyle(surpriseStyle);
}

/** Counts a food in surprise mode. Returns true when the style just changed. */
export function surpriseOnFood(): boolean {
    if (!isSurprise() || --foodsUntilSurprise > 0) {
        return false;
    }

    foodsUntilSurprise = rollSurpriseInterval();
    surpriseStyle = randomStyle(surpriseStyle);
    return true;
}

export function theme(): Theme {
    return THEMES[activeStyle()];
}

export function toCss(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
}

export function textCss(role: TextRole): string {
    return toCss(theme().text[role]);
}
