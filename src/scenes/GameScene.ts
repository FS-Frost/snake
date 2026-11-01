import Phaser from "phaser";
import {
    BOARD_H,
    BOARD_W,
    BOARD_X,
    BOARD_Y,
    CONTROLS_X,
    GRID_COLS,
    GRID_ROWS,
    HEIGHT,
    HUD_X,
    LAYOUT,
    SCENES,
    WIDTH,
} from "../config";
import { audio } from "../audio/Audio";
import { SPEED_CURVES, ticksPerSecond } from "../core/difficulty";
import { type AdvanceResult, SnakeGame, type StepResult } from "../core/SnakeGame";
import type { Cell, Direction } from "../core/types";
import { difficultyLabel, itemLabel, type Key, modeLabel, t } from "../i18n";
import { getHighScore, getSettings, submitScore } from "../storage";
import { activeStyle, styleLabel, surpriseOnFood, type TextRole, theme, toCss } from "../theme";
import { addBackdrop, particleTexture } from "../ui/Background";
import { applyNeonPost, fadeIn, flash, gameText, shake, vibrate } from "../ui/neon";
import { TouchControls } from "../ui/TouchControls";
import { gameSong, type TrackId, unlockEarned } from "../tracks";
import { cellX, cellY, drawBoard, FoodView, ItemView, ObstacleView, PowerHud, SnakeView } from "./GameViews";
import type { GameSettings } from "./MenuScene";

export type Phase = "countdown" | "playing" | "dying" | "over";

/** A running match carried across a relayout (screen rotation), so the board is rebuilt without losing it. */
export interface ResumeState {
    logic: SnakeGame;
    elapsedMs: number;
    phase: Phase;
    /** Surprise-mode style switch: keep playing and show the channel-change effect instead of pausing. */
    styleSwitch?: boolean;
}

export interface GameSceneData extends GameSettings {
    resume?: ResumeState;
}

export interface GameOverData {
    settings: GameSettings;
    score: number;
    best: number;
    isRecord: boolean;
    won: boolean;
    length: number;
    level: number;
    timeMs: number;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
};

/** Width kept free at the right of the top HUD for the pause button. */
const PAUSE_SLOT = 64;

/** Centers of the four top-HUD columns (portrait and desktop). */
function hudColumns(): number[] {
    const width = BOARD_W - PAUSE_SLOT;
    return [0, 1, 2, 3].map((i) => BOARD_X + (width * (i + 0.5)) / 4);
}

/** Large frame gaps (tab switch, debugger) must not fast-forward the snake into a wall. */
const MAX_FRAME_MS = 250;
const COUNTDOWN_STEP_MS = 550;

export class GameScene extends Phaser.Scene {
    private settings!: GameSettings;
    private logic!: SnakeGame;
    private phase: Phase = "countdown";
    private accumulator = 0;
    private elapsedMs = 0;
    private best = 0;

    private snakeView!: SnakeView;
    private foodView!: FoodView;
    private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
    private scoreText!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private speedText!: Phaser.GameObjects.Text;
    private itemView!: ItemView;
    private obstacleView!: ObstacleView;
    private powerHud!: PowerHud;

    /** Segments already blown up during the death animation. */
    private explodedSegments = 0;

    constructor() {
        super(SCENES.game);
    }

    create(data: GameSceneData): void {
        const { resume } = data;
        this.settings = { mode: data.mode, difficulty: data.difficulty };
        this.logic =
            resume?.logic ??
            new SnakeGame({
                cols: GRID_COLS,
                rows: GRID_ROWS,
                mode: data.mode,
                difficulty: data.difficulty,
            });
        // A resumed countdown restarts as plain play behind the pause menu.
        this.phase = resume ? (resume.phase === "countdown" ? "playing" : resume.phase) : "countdown";
        this.accumulator = 0;
        this.elapsedMs = resume?.elapsedMs ?? 0;
        this.explodedSegments = 0;
        this.best = getHighScore(data.mode, data.difficulty);

        addBackdrop(this);
        drawBoard(this, data.mode);
        this.powerHud =
            LAYOUT === "landscape"
                ? new PowerHud(this, { comboX: HUD_X, comboY: 170, comboAlign: "center", effectsX: HUD_X, effectsY: 450, stack: true })
                : new PowerHud(this, {
                      comboX: hudColumns()[1],
                      comboY: 84,
                      comboAlign: "center",
                      effectsX: WIDTH / 2,
                      effectsY: BOARD_Y + BOARD_H + 32,
                      stack: false,
                  });
        this.obstacleView = new ObstacleView(this);
        this.obstacleView.add(this.logic.obstacles, false);
        this.foodView = new FoodView(this);
        this.itemView = new ItemView(this);
        this.snakeView = new SnakeView(this);
        const pixel = theme().pixel;
        this.sparks = this.add.particles(0, 0, particleTexture(), {
            speed: { min: 80, max: 260 },
            lifespan: { min: 300, max: 650 },
            // Pixel squares keep their size and pop out; neon sparks shrink and fade.
            scale: pixel ? 1 : { start: 0.9, end: 0 },
            alpha: pixel ? 1 : { start: 1, end: 0 },
            blendMode: theme().particleBlend,
            emitting: false,
        });
        this.createHud();
        new TouchControls(this, (direction) => this.turn(direction));

        this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey, this);
        this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
        this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPause, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey, this);
            this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
            this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPause, this);
        });

        applyNeonPost(this);

        if (resume) {
            audio.setIntensity(this.logic.foodsEaten / 30);
            audio.setSlowmo(this.logic.isActive("slowmo"));

            if (resume.styleSwitch) {
                this.playChannelSwitch();
                this.announceTracks(unlockEarned(gameSong(this.logic.level), theme().pixel));
                return;
            }

            // Rebuilt after a rotation: land on the pause menu so the player re-orients before moving on.
            // Draw one frame now: a paused scene never runs update(), so the board and HUD would stay empty.
            this.update(0, 0);
            if (this.phase === "playing") {
                this.pause();
            }
            return;
        }

        fadeIn(this);
        const song = gameSong(this.logic.level);
        audio.setMusic(song);
        this.announceTracks(unlockEarned(song, theme().pixel));
        audio.setIntensity(0);
        audio.setMuffled(false);
        audio.setSlowmo(false);
        this.runCountdown();
    }

    /** Snapshot for relayout; null while the death animation runs (it must finish first). */
    getResumeState(): ResumeState | null {
        if (this.phase === "dying") {
            return null;
        }
        return { logic: this.logic, elapsedMs: this.elapsedMs, phase: this.phase };
    }

    getSettings(): GameSettings {
        return this.settings;
    }

    update(_time: number, delta: number): void {
        if (this.phase === "playing") {
            const frame = Math.min(delta, MAX_FRAME_MS);
            this.elapsedMs += frame;
            this.accumulator += frame;
            this.handleAdvance(this.logic.advance(frame));

            while (this.phase === "playing" && this.accumulator >= this.logic.tickMs) {
                this.accumulator -= this.logic.tickMs;
                this.tick();
            }
        }

        // Old School moves cell by cell, like the originals.
        const alpha = this.phase === "playing" && !theme().pixel ? this.accumulator / this.logic.tickMs : 1;
        const dying = this.phase === "dying" || this.phase === "over";
        this.snakeView.render(this.logic, { alpha, dying, exploded: this.explodedSegments });
        this.foodView.render(this.phase === "over" ? null : this.logic.food);
        this.itemView.render(this.phase === "over" ? null : this.logic.item, this.logic.clock);
        this.powerHud.update(this.logic);
        this.updateHud();
    }

    private tick(): void {
        const result = this.logic.step();

        if (result.ate) {
            this.onEat(result);
        }

        if (result.picked) {
            this.onPick(result);
        }

        if (result.itemSpawned) {
            audio.itemSpawn();
        }

        if (result.obstaclesAdded.length > 0) {
            this.onLevelUp(result.obstaclesAdded);
        }

        if (result.died) {
            this.onDeath();
        } else if (result.won) {
            this.onWin();
        }
    }

    // ---------------------------------------------------------------- input

    private handleKey(event: KeyboardEvent): void {
        const direction = KEY_DIRECTIONS[event.code];

        if (direction) {
            this.turn(direction);
            return;
        }

        if (event.code === "Escape" || event.code === "KeyP") {
            this.pause();
        }
    }

    private turn(direction: Direction): void {
        if (this.phase === "playing" || this.phase === "countdown") {
            this.logic.queueTurn(direction);
        }
    }

    private autoPause(): void {
        if (this.scene.isActive()) {
            this.pause();
        }
    }

    private pause(): void {
        if (this.phase !== "playing" && this.phase !== "countdown") {
            return;
        }

        audio.pause();
        audio.setMuffled(true);
        this.scene.launch(SCENES.pause, this.settings);
        this.scene.pause();
    }

    // ---------------------------------------------------------------- flow

    private runCountdown(): void {
        const labels = ["3", "2", "1", t("go")];
        const touch = this.sys.game.device.input.touch;
        const hintText = !touch ? t("gameHint") : getSettings().touch === "swipe" ? t("swipeHint") : "";
        const hint = gameText(this, WIDTH / 2, BOARD_Y + BOARD_H * 0.68, hintText, {
            size: 16,
            color: "dim",
            glow: 0,
            weight: 400,
        });

        labels.forEach((label, index) => {
            this.time.delayedCall(index * COUNTDOWN_STEP_MS, () => {
                const isLast = index === labels.length - 1;
                audio.countdown(isLast);
                const text = gameText(this, WIDTH / 2, BOARD_Y + BOARD_H / 2, label, {
                    size: isLast ? 96 : 120,
                    weight: 900,
                    color: isLast ? "highlight" : "primary",
                    glow: 24,
                });
                text.setScale(1.8).setAlpha(0);
                this.tweens.add({
                    targets: text,
                    scale: 1,
                    alpha: 1,
                    duration: 180,
                    ease: "Back.Out",
                    onComplete: () => {
                        this.tweens.add({
                            targets: text,
                            alpha: 0,
                            scale: 0.6,
                            delay: COUNTDOWN_STEP_MS - 300,
                            duration: 160,
                            onComplete: () => text.destroy(),
                        });
                    },
                });

                if (isLast) {
                    this.phase = "playing";
                    this.tweens.add({ targets: hint, alpha: 0, duration: 300, onComplete: () => hint.destroy() });
                }
            });
        });
    }

    private handleAdvance(result: AdvanceResult): void {
        if (result.itemExpired) {
            this.sparks.setParticleTint(theme().text.dim);
            this.sparks.explode(10, cellX(result.itemExpired.x), cellY(result.itemExpired.y));
            audio.itemExpire();
        }

        for (const effect of result.effectsEnded) {
            audio.effectEnd();
            if (effect === "slowmo") {
                audio.setSlowmo(false);
            }
        }
    }

    /** Floating text that rises and fades. */
    private popup(x: number, y: number, label: string, color: TextRole, size = 20): void {
        const text = gameText(this, x, y - 10, label, { size, color, glow: 10 });
        this.tweens.add({
            targets: text,
            y: y - 54,
            alpha: 0,
            duration: 750,
            ease: "Cubic.Out",
            onComplete: () => text.destroy(),
        });
    }

    private onEat(result: StepResult): void {
        const head = this.logic.head;
        const x = cellX(head.x);
        const y = cellY(head.y);

        this.sparks.setParticleTint(theme().food);
        this.sparks.explode(18, x, y);
        this.sparks.setParticleTint(theme().text.highlight);
        this.sparks.explode(6, x, y);

        this.popup(x, y, `+${result.points}`, "highlight", this.logic.combo > 1 ? 24 : 20);

        this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 70, yoyo: true });
        shake(this, 80, 0.002);
        vibrate(12);
        audio.eat(this.logic.foodsEaten);
        audio.setIntensity(this.logic.foodsEaten / 30);

        if (surpriseOnFood()) {
            this.switchStyle();
        }
    }

    /** "New track" toast at the top of the board for each Fonoteca unlock. */
    private announceTracks(ids: TrackId[]): void {
        ids.forEach((id, index) => {
            this.time.delayedCall(index * 1900, () => {
                const toast = gameText(this, WIDTH / 2, BOARD_Y + 40, `${t("newTrack")}: ${t(`track.${id}` as Key)}`, {
                    size: 18,
                    color: "highlight",
                    glow: 8,
                }).setDepth(900);
                toast.setAlpha(0).setY(toast.y - 16);
                audio.trackUnlocked();
                this.tweens.chain({
                    targets: toast,
                    tweens: [
                        { alpha: 1, y: toast.y + 16, duration: 220, ease: "Back.Out" },
                        { alpha: 0, delay: 1400, duration: 260, onComplete: () => toast.destroy() },
                    ],
                });
            });
        });
    }

    /** Surprise mode: rebuild every visual in the new style without interrupting the match. */
    private switchStyle(): void {
        if (this.phase !== "playing") {
            return;
        }

        audio.setChiptune(theme().pixel);
        audio.channelSwitch();
        document.body.style.background = toCss(theme().background);
        this.phase = "over"; // Freeze this instance until the restart replaces it.
        this.scene.restart({
            ...this.settings,
            resume: { logic: this.logic, elapsedMs: this.elapsedMs, phase: "playing", styleSwitch: true },
        });
    }

    /** TV channel change: static bars in the new palette, then the style name. */
    private playChannelSwitch(): void {
        const style = theme();

        if (getSettings().flash) {
            const colors = [style.background, style.board, style.text.primary, style.text.danger, style.text.highlight, style.snakeHead];
            const noise = this.add.graphics().setDepth(1000);
            const draw = () => {
                noise.clear();
                for (let y = 0; y < HEIGHT; y += Phaser.Math.Between(6, 26)) {
                    noise.fillStyle(Phaser.Utils.Array.GetRandom(colors), 1);
                    noise.fillRect(0, y, WIDTH, Phaser.Math.Between(3, 22));
                }
            };
            draw();
            this.time.addEvent({ delay: 40, repeat: 5, callback: draw });
            this.tweens.add({ targets: noise, alpha: 0, delay: 160, duration: 160, onComplete: () => noise.destroy() });
        }

        const banner = gameText(this, WIDTH / 2, BOARD_Y + BOARD_H / 2, styleLabel(activeStyle()), {
            size: 56,
            weight: 900,
            color: "highlight",
            glow: 20,
        }).setDepth(1001);
        banner.setScale(1.6).setAlpha(0);
        this.tweens.chain({
            targets: banner,
            tweens: [
                { scale: 1, alpha: 1, duration: 180, ease: "Back.Out" },
                { alpha: 0, delay: 600, duration: 250, onComplete: () => banner.destroy() },
            ],
        });
    }

    private onPick(result: StepResult): void {
        const type = result.picked!;
        const head = this.logic.head;
        const x = cellX(head.x);
        const y = cellY(head.y);
        this.sparks.setParticleTint(theme().items[type]);
        this.sparks.explode(type === "golden" ? 40 : 24, x, y);
        audio.powerUp(type);
        vibrate(20);

        this.popup(x, y - 18, itemLabel(type), "text", 22);
        this.popup(x, y + 14, `+${result.points}`, "highlight");

        switch (type) {
            case "golden":
                flash(this, 120, theme().items.golden);
                shake(this, 120, 0.004);
                break;
            case "slowmo":
                audio.setSlowmo(true);
                break;
            case "scissors":
                // Severed tail pieces burst where they were.
                result.cut.forEach((cell, index) => {
                    this.time.delayedCall(index * 30, () => {
                        this.sparks.setParticleTint(theme().snakeBody[1]);
                        this.sparks.explode(8, cellX(cell.x), cellY(cell.y));
                    });
                });
                break;
        }
    }

    private onLevelUp(cells: Cell[]): void {
        audio.levelUp();
        const song = gameSong(this.logic.level);
        if (song !== audio.currentSection) {
            audio.setMusic(song);
            this.announceTracks(unlockEarned(song, theme().pixel));
        }
        this.obstacleView.add(cells);

        const banner = gameText(this, WIDTH / 2, BOARD_Y + BOARD_H * 0.3, `${t("level")} ${this.logic.level}`, {
            size: 56,
            weight: 900,
            color: "danger",
            glow: 20,
        });
        banner.setScale(0.4).setAlpha(0);
        this.tweens.chain({
            targets: banner,
            tweens: [
                { scale: 1, alpha: 1, duration: 260, ease: "Back.Out" },
                { alpha: 0, y: banner.y - 30, delay: 700, duration: 300, onComplete: () => banner.destroy() },
            ],
        });
    }

    private onDeath(): void {
        this.phase = "dying";
        shake(this, 380, 0.014);
        flash(this, 180, theme().text.danger);
        vibrate([60, 40, 120]);
        audio.die();
        audio.setMusic("off");
        audio.setSlowmo(false);

        // Blow the body up from head to tail; long snakes speed up so it never drags.
        const segments = this.logic.snake.length;
        const interval = Math.max(12, Math.min(45, 700 / segments));
        this.time.addEvent({
            delay: interval,
            repeat: segments - 1,
            callback: () => {
                const cell = this.logic.snake[this.explodedSegments];
                this.sparks.setParticleTint(this.explodedSegments === 0 ? theme().snakeHead : theme().text.danger);
                this.sparks.explode(this.explodedSegments === 0 ? 30 : 8, cellX(cell.x), cellY(cell.y));
                this.explodedSegments++;
            },
        });

        this.time.delayedCall(segments * interval + 650, () => this.finish(false));
    }

    private onWin(): void {
        this.phase = "dying";
        flash(this, 400, theme().text.highlight);
        audio.setMusic("off");
        audio.fanfare();

        for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 180, () => {
                this.sparks.setParticleTint(i % 2 === 0 ? theme().text.highlight : theme().text.primary);
                this.sparks.explode(40, Phaser.Math.Between(BOARD_X, BOARD_X + BOARD_W), Phaser.Math.Between(BOARD_Y, BOARD_Y + BOARD_H));
            });
        }

        this.time.delayedCall(1400, () => this.finish(true));
    }

    private finish(won: boolean): void {
        this.phase = "over";
        const isRecord = submitScore(this.settings.mode, this.settings.difficulty, this.logic.score);
        const data: GameOverData = {
            settings: this.settings,
            score: this.logic.score,
            best: Math.max(this.best, this.logic.score),
            isRecord,
            won,
            length: this.logic.snake.length,
            level: this.logic.level,
            timeMs: this.elapsedMs,
        };

        this.scene.launch(SCENES.gameOver, data);
        this.scene.pause();
    }

    // ---------------------------------------------------------------- HUD

    private createHud(): void {
        if (LAYOUT === "landscape") {
            this.createSideHud();
            return;
        }

        const labelY = 44;
        const valueY = 84;
        const label = { size: 13, color: "dim", glow: 0, weight: 400 } as const;
        // Four equal centered columns (score, combo, time, best) plus room for the pause button.
        // Labels grow on phones, so fixed offsets would make them overlap.
        const columns = hudColumns();

        // Small glow on numbers: big blur turns digits into blobs under the bloom.
        gameText(this, columns[0], labelY, t("score"), label);
        this.scoreText = gameText(this, columns[0], valueY, "0", { size: 34, color: "primary", weight: 500, glow: 5 });

        gameText(this, columns[2], labelY, t("time"), label);
        this.timeText = gameText(this, columns[2], valueY, "00:00", { size: 28, color: "text", weight: 400, glow: 0 });

        gameText(this, columns[3], labelY, t("best"), label);
        this.bestText = gameText(this, columns[3], valueY, String(this.best), {
            size: 28,
            color: "highlight",
            weight: 500,
            glow: 5,
        });

        this.createPauseButton(BOARD_X + BOARD_W - PAUSE_SLOT / 2 + 8, 64);

        const footerY = BOARD_Y + BOARD_H + 32;
        const tag = `${modeLabel(this.settings.mode)}  ·  ${difficultyLabel(this.settings.difficulty)}`;
        gameText(this, BOARD_X, footerY, tag, { size: 14, color: "secondary", glow: 6, align: "left" });
        this.speedText = gameText(this, BOARD_X + BOARD_W, footerY, "", {
            size: 14,
            color: "secondary",
            glow: 6,
            align: "right",
        });
    }

    /** Landscape: everything stacked in the column beside the board. */
    private createSideHud(): void {
        const x = HUD_X;
        const label = { size: 13, color: "dim", glow: 0, weight: 400 } as const;

        gameText(this, x, 36, t("score"), label);
        this.scoreText = gameText(this, x, 70, "0", { size: 34, color: "primary", weight: 500, glow: 5 });
        // y 136-170 belongs to the combo meter (PowerHud).
        gameText(this, x, 236, t("time"), label);
        this.timeText = gameText(this, x, 270, "00:00", { size: 28, color: "text", weight: 400, glow: 0 });
        gameText(this, x, 336, t("best"), label);
        this.bestText = gameText(this, x, 370, String(this.best), { size: 28, color: "highlight", weight: 500, glow: 5 });

        const tagStyle = { size: 14, color: "secondary", glow: 6 } as const;
        gameText(this, x, BOARD_Y + BOARD_H - 70, modeLabel(this.settings.mode), tagStyle);
        gameText(this, x, BOARD_Y + BOARD_H - 40, difficultyLabel(this.settings.difficulty), tagStyle);
        this.speedText = gameText(this, x, BOARD_Y + BOARD_H - 6, "", tagStyle);

        // Pause sits at the top of the controls column, within thumb reach.
        this.createPauseButton(CONTROLS_X, BOARD_Y + 30);
    }

    /** Needed on touch screens without an ESC key; bigger there so a thumb can hit it. */
    private createPauseButton(x: number, y: number): void {
        const touch = this.sys.game.device.input.touch;
        const pauseButton = gameText(this, x, y, "II", { size: touch ? 48 : 30, color: "primary", weight: 900 });
        // Generous hit area around the glyph.
        const pad = touch ? 28 : 10;
        pauseButton.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(-pad, -pad, pauseButton.width + pad * 2, pauseButton.height + pad * 2),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
        });
        pauseButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.pause());
    }

    private updateHud(): void {
        this.scoreText.setText(String(this.logic.score));
        const best = Math.max(this.best, this.logic.score);
        this.bestText.setText(String(best));

        const seconds = Math.floor(this.elapsedMs / 1000);
        const pad = (n: number) => n.toString().padStart(2, "0");
        this.timeText.setText(`${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`);

        const { difficulty } = this.settings;
        const multiplier = ticksPerSecond(difficulty, this.logic.foodsEaten) / SPEED_CURVES[difficulty].start;
        this.speedText.setText(`${t("speed")}  x${multiplier.toFixed(2)}`);
    }
}
