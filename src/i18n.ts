import type { Difficulty, ItemType, Mode } from "./core/types";
import { getSettings } from "./storage";
import { theme } from "./theme";

export type Language = "en" | "es";

const en = {
    title: "SNAKE",
    subtitle: "NEON GRID",
    oldSchool: "OLD SCHOOL",
    play: "PLAY",
    mode: "MODE",
    difficulty: "DIFFICULTY",
    best: "BEST",
    score: "SCORE",
    time: "TIME",
    speed: "SPEED",
    paused: "PAUSED",
    resume: "RESUME",
    restart: "RESTART",
    mainMenu: "MAIN MENU",
    retry: "RETRY",
    gameOver: "GAME OVER",
    victory: "BOARD CLEARED",
    newRecord: "NEW RECORD",
    length: "LENGTH",
    go: "GO!",
    menuHint: "ARROWS select  ·  ENTER confirm",
    gameHint: "ARROWS / WASD move  ·  ESC pause",
    "mode.wrap": "WRAP",
    "mode.classic": "CLASSIC",
    "difficulty.easy": "EASY",
    "difficulty.normal": "NORMAL",
    "difficulty.hard": "HARD",
    settings: "SETTINGS",
    music: "MUSIC",
    sfx: "SOUND FX",
    bloom: "GLOW",
    shake: "SCREEN SHAKE",
    flash: "FLASHES",
    touch: "TOUCH",
    language: "LANGUAGE",
    back: "BACK",
    on: "ON",
    off: "OFF",
    unavailable: "N/A",
    "touch.swipe": "SWIPE",
    "touch.dpad": "D-PAD",
    "touch.dpad.left": "D-PAD LEFT",
    "touch.dpad.center": "D-PAD CENTER",
    "touch.dpad.right": "D-PAD RIGHT",
    style: "STYLE",
    swipeHint: "SWIPE ANYWHERE TO TURN",
    tapToStart: "TAP OR PRESS ANY KEY",
    "language.en": "ENGLISH",
    "language.es": "ESPAÑOL",
    level: "LEVEL",
    combo: "COMBO",
    "item.golden": "GOLD",
    "item.slowmo": "SLOW-MO",
    "item.ghost": "GHOST",
    "item.scissors": "SCISSORS",
};

type Key = keyof typeof en;

const es: Record<Key, string> = {
    title: "SNAKE",
    subtitle: "NEON GRID",
    oldSchool: "OLD SCHOOL",
    play: "JUGAR",
    mode: "MODO",
    difficulty: "DIFICULTAD",
    best: "RÉCORD",
    score: "PUNTOS",
    time: "TIEMPO",
    speed: "VELOCIDAD",
    paused: "PAUSA",
    resume: "CONTINUAR",
    restart: "REINICIAR",
    mainMenu: "MENÚ PRINCIPAL",
    retry: "REINTENTAR",
    gameOver: "FIN DEL JUEGO",
    victory: "TABLERO COMPLETO",
    newRecord: "NUEVO RÉCORD",
    length: "LARGO",
    go: "¡YA!",
    menuHint: "FLECHAS elegir  ·  ENTER confirmar",
    gameHint: "FLECHAS / WASD mover  ·  ESC pausa",
    "mode.wrap": "SIN BORDES",
    "mode.classic": "CLÁSICO",
    "difficulty.easy": "FÁCIL",
    "difficulty.normal": "NORMAL",
    "difficulty.hard": "DIFÍCIL",
    settings: "AJUSTES",
    music: "MÚSICA",
    sfx: "EFECTOS",
    bloom: "BRILLO NEÓN",
    shake: "TEMBLOR",
    flash: "DESTELLOS",
    touch: "TÁCTIL",
    language: "IDIOMA",
    back: "VOLVER",
    on: "SÍ",
    off: "NO",
    unavailable: "N/D",
    "touch.swipe": "DESLIZAR",
    "touch.dpad": "CRUCETA",
    "touch.dpad.left": "CRUCETA IZQ.",
    "touch.dpad.center": "CRUCETA CENTRO",
    "touch.dpad.right": "CRUCETA DER.",
    style: "ESTILO",
    swipeHint: "DESLIZA PARA GIRAR",
    tapToStart: "TOCA O PULSA UNA TECLA",
    "language.en": "ENGLISH",
    "language.es": "ESPAÑOL",
    level: "NIVEL",
    combo: "COMBO",
    "item.golden": "ORO",
    "item.slowmo": "CÁMARA LENTA",
    "item.ghost": "FANTASMA",
    "item.scissors": "TIJERAS",
};

const dictionaries: Record<Language, Record<Key, string>> = { en, es };

let language: Language = getSettings().language;

export function setLanguage(next: Language): void {
    language = next;
}

export function getLanguage(): Language {
    return language;
}

/**
 * The pixel font squeezes accented capitals into 8 px and they read as lowercase, so Old School
 * drops acute accents like 8-bit games did. Ñ survives: without it words change meaning.
 */
function stripAccents(text: string): string {
    return text.replace(/[ÁÉÍÓÚÜáéíóúü]/g, (ch) => ch.normalize("NFD")[0]);
}

export function t(key: Key): string {
    const text = dictionaries[language][key];
    return theme().pixel ? stripAccents(text) : text;
}

export function modeLabel(mode: Mode): string {
    return t(`mode.${mode}`);
}

export function difficultyLabel(difficulty: Difficulty): string {
    return t(`difficulty.${difficulty}`);
}

export function itemLabel(item: ItemType): string {
    return t(`item.${item}`);
}
