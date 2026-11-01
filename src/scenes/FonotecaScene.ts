import Phaser from "phaser";
import { audio, type TimbreOverride } from "../audio/Audio";
import { HEIGHT, SCENES, WIDTH } from "../config";
import { type Key, t } from "../i18n";
import { textCss, theme } from "../theme";
import { isUnlocked, type Track, TRACKS } from "../tracks";
import { Background } from "../ui/Background";
import { type MenuItem, MenuList } from "../ui/MenuList";
import { applyNeonPost, fadeIn, gameText, transitionTo } from "../ui/neon";

/**
 * Fonoteca: listen to the procedural soundtrack. Unlocked tracks play on demand; options for
 * continuous play (next track every few loops), intense tempo, forced timbre and a live visualizer.
 */

const LOOPS_PER_TRACK = 4;
const VIZ_BARS = 16;
const TITLE_Y = 76;
const LIST_TOP = 146;
/** Room under the list for the unlock hint (up to two lines). */
const HINT_ROOM = 70;

type TimbreChoice = "original" | "neon" | "chip";
const TIMBRES: readonly TimbreChoice[] = ["original", "neon", "chip"];

/** Player state survives leaving and re-entering the Fonoteca within a session. */
const state = {
    current: null as Track | null,
    playing: false,
    continuous: true,
    intense: false,
    timbre: "original" as TimbreChoice,
    visualizer: true,
    loops: 0,
};

export class FonotecaScene extends Phaser.Scene {
    private menu!: MenuList;
    private hint!: Phaser.GameObjects.Text;
    private viz!: Phaser.GameObjects.Graphics;
    private vizBox!: Phaser.Geom.Rectangle;
    private readonly spectrum = new Uint8Array(128);

    constructor() {
        super(SCENES.fonoteca);
    }

    create(): void {
        // Low horizon: the floor grid stays under the list instead of behind it.
        new Background(this, { sun: false, horizon: HEIGHT * 0.93, demo: false });
        fadeIn(this);

        // Landscape screens get two columns (list | visualizer); otherwise the visualizer sits below.
        const wide = WIDTH >= 1000;
        const listX = wide ? WIDTH * 0.36 : WIDTH / 2;
        const title = gameText(this, listX, TITLE_Y, t("fonoteca"), { size: 48, weight: 900, color: "text", glow: 22 });
        title.setShadow(theme().pixel ? 4 : 0, theme().pixel ? 4 : 0, textCss(theme().pixel ? "dim" : "primary"), theme().pixel ? 0 : 22, false, true);

        const items = this.buildItems();
        // Spacing from the height actually available: roomier on tall phones, tighter on desktop.
        const reserved = wide ? 40 : 200;
        const spacing = Phaser.Math.Clamp((HEIGHT - LIST_TOP - HINT_ROOM - reserved) / items.length, 38, 56);
        const listBottom = LIST_TOP + (items.length - 1) * spacing;
        const columnWidth = wide ? WIDTH * 0.62 : WIDTH;

        // Unlock hint for the focused locked track: a separate line keeps every list label short.
        // Top-anchored so a wrapped (two-line) hint grows downwards, away from the list.
        this.hint = gameText(this, listX, listBottom + 44, "", { size: 16, color: "highlight", glow: 6, weight: 400 })
            .setWordWrapWidth(Math.min(columnWidth, 720) - 60)
            .setAlign("center")
            .setOrigin(0.5, 0);

        this.menu = new MenuList(this, listX, LIST_TOP, items, {
            spacing,
            size: 20,
            maxWidth: Math.min(columnWidth, 720) - 48,
            onBack: () => this.close(),
            onFocus: (index) => this.showHint(index),
        });

        // Visualizer: right column when wide, otherwise whatever room is left at the bottom.
        const vizW = wide ? Math.min(420, WIDTH * 0.3) : 560;
        const freeTop = listBottom + HINT_ROOM + 40;
        // Old School draws a bezel frame 32 px in from the edges: stay inside it.
        const bottomMargin = theme().pixel ? 52 : 30;
        const vizH = wide ? 260 : Math.min(300, HEIGHT - freeTop - bottomMargin);
        const vizX = wide ? WIDTH * 0.76 - vizW / 2 : WIDTH / 2 - vizW / 2;
        const vizY = wide ? HEIGHT / 2 - vizH / 2 : HEIGHT - vizH - bottomMargin;
        this.vizBox = new Phaser.Geom.Rectangle(vizX, vizY, vizW, vizH);
        this.viz = this.add.graphics();

        audio.onLoop(() => this.onLoop());
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.onLoop(null));

        // Opening starts the music right away, on the track that matches the current look.
        this.play(state.current ?? TRACKS[theme().pixel ? 1 : 0]);
        applyNeonPost(this);
    }

    update(): void {
        this.drawVisualizer();
    }

    private buildItems(): MenuItem[] {
        const tracks: MenuItem[] = TRACKS.map((track, index) => ({
            label: () => {
                const number = `${index + 1}. `;
                if (!isUnlocked(track)) {
                    return `${number}???  ${t("locked")}`;
                }
                const playing = state.playing && state.current?.id === track.id;
                return `${playing ? "♪ " : ""}${number}${t(`track.${track.id}` as Key)}`;
            },
            onSelect: () => {
                if (isUnlocked(track)) {
                    this.play(track);
                } else {
                    audio.uiBack();
                }
            },
        }));

        const options: MenuItem[] = [
            { label: () => (state.playing ? t("pause_") : t("play_")), onSelect: () => this.togglePlay() },
            {
                label: () => `${t("continuous")}: ${state.continuous ? t("on") : t("off")}`,
                onChange: () => {
                    state.continuous = !state.continuous;
                },
            },
            {
                label: () => `${t("intense")}: ${state.intense ? t("on") : t("off")}`,
                onChange: () => {
                    state.intense = !state.intense;
                    if (state.playing) {
                        audio.setIntensity(state.intense ? 1 : 0);
                    }
                },
            },
            {
                label: () => `${t("timbre")}: ${t(`timbre.${state.timbre}`)}`,
                onChange: (delta) => {
                    const index = TIMBRES.indexOf(state.timbre);
                    state.timbre = TIMBRES[(index + delta + TIMBRES.length) % TIMBRES.length];
                    this.applyTimbre();
                },
            },
            {
                label: () => `${t("visualizer")}: ${state.visualizer ? t("on") : t("off")}`,
                onChange: () => {
                    state.visualizer = !state.visualizer;
                },
            },
            { label: () => t("back"), onSelect: () => this.close() },
        ];

        return [...tracks, ...options];
    }

    private showHint(index: number): void {
        const track = TRACKS[index];
        this.hint.setText(track && !isUnlocked(track) ? `${t("unlockBy")}: ${t(`lock.${track.id}` as Key)}` : "");
    }

    private play(track: Track): void {
        state.current = track;
        state.playing = true;
        state.loops = 0;
        this.applyTimbre();
        audio.setIntensity(state.intense ? 1 : 0);
        // Restart from the top even when re-selecting the song that is already playing.
        audio.setMusic("off");
        audio.setMusic(track.song);
        this.menu?.refresh();
    }

    private togglePlay(): void {
        if (state.playing) {
            state.playing = false;
            audio.setMusic("off");
            this.menu.refresh();
        } else if (state.current) {
            this.play(state.current);
        }
    }

    private applyTimbre(): void {
        const timbre: TimbreOverride =
            state.timbre === "original" ? (state.current?.timbre ?? "neon") : state.timbre;
        audio.setTimbreOverride(timbre);
    }

    /** Continuous play: after a few loops move on to the next unlocked track. */
    private onLoop(): void {
        if (!state.playing || !state.continuous || ++state.loops < LOOPS_PER_TRACK) {
            return;
        }
        const unlocked = TRACKS.filter(isUnlocked);
        const index = unlocked.findIndex((track) => track.id === state.current?.id);
        this.play(unlocked[(index + 1) % unlocked.length]);
    }

    /** Spectrum bars sampled on a roughly logarithmic frequency scale, drawn in the current style. */
    private drawVisualizer(): void {
        const g = this.viz;
        const style = theme();
        const box = this.vizBox;
        g.clear();

        if (!state.visualizer || box.height < 40) {
            return;
        }

        // Solid backing so the bars stay readable over the backdrop.
        g.fillStyle(style.pixel ? style.background : style.board, style.pixel ? 1 : 0.85);
        g.lineStyle(style.pixel ? 4 : 2, style.text.dim, style.pixel ? 1 : 0.6);
        if (style.pixel) {
            g.fillRect(box.x, box.y, box.width, box.height);
            g.strokeRect(box.x, box.y, box.width, box.height);
        } else {
            g.fillRoundedRect(box.x, box.y, box.width, box.height, 12);
            g.strokeRoundedRect(box.x, box.y, box.width, box.height, 12);
        }

        const live = state.playing && audio.getSpectrum(this.spectrum);
        const pad = 12;
        const gap = 6;
        const barW = (box.width - pad * 2 - gap * (VIZ_BARS - 1)) / VIZ_BARS;
        const maxH = box.height - pad * 2;
        const from = Phaser.Display.Color.ValueToColor(style.text.primary);
        const to = Phaser.Display.Color.ValueToColor(style.text.danger);

        for (let i = 0; i < VIZ_BARS; i++) {
            const lo = Math.floor(2 * 1.25 ** i);
            const hi = Math.max(lo + 1, Math.floor(2 * 1.25 ** (i + 1)));
            let value = 0;
            for (let k = lo; k < hi && k < this.spectrum.length; k++) {
                value = Math.max(value, this.spectrum[k]);
            }

            let h = live ? Math.max(4, (value / 255) * maxH) : 4;
            if (style.pixel) {
                // Stepped like an LED meter.
                h = Math.max(8, Math.floor(h / 12) * 12);
            }

            const mix = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, VIZ_BARS - 1, i);
            const color = style.pixel ? style.text.primary : Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
            g.fillStyle(color, 1);
            g.fillRect(box.x + pad + i * (barW + gap), box.bottom - pad - h, barW, h);
        }
    }

    private close(): void {
        this.menu.setEnabled(false);
        audio.onLoop(null);
        audio.setIntensity(0);
        audio.setTimbreOverride(null);
        audio.setMusic("title");
        state.playing = false;
        transitionTo(this, SCENES.menu);
    }
}
