import type { Difficulty, Mode } from "./core/types";

export type Language = "en" | "es";

const en = {
    title: "SNAKE",
    subtitle: "NEON GRID",
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
};

type Key = keyof typeof en;

const es: Record<Key, string> = {
    title: "SNAKE",
    subtitle: "NEON GRID",
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
};

const dictionaries: Record<Language, Record<Key, string>> = { en, es };

let language: Language = navigator.language.toLowerCase().startsWith("es") ? "es" : "en";

export function setLanguage(next: Language): void {
    language = next;
}

export function getLanguage(): Language {
    return language;
}

export function t(key: Key): string {
    return dictionaries[language][key];
}

export function modeLabel(mode: Mode): string {
    return t(`mode.${mode}`);
}

export function difficultyLabel(difficulty: Difficulty): string {
    return t(`difficulty.${difficulty}`);
}
