import type { ItemType } from "../core/types";
import { getSettings } from "../storage";
import { type SongId, SONGS, STEPS_PER_BAR, type Voices } from "./songs";

/**
 * Procedural audio: every sound and the music are synthesized with Web Audio. No files.
 *
 * Graph:
 *   voices → musicBus → musicFilter (lowpass, closes on pause) → musicGain ┬→ analyser (visualizer)
 *   sfx voices → sfxGain ─────────────────────────────────────────────────┴→ compressor → destination
 *
 * Songs live in songs.ts; this engine schedules their steps with a lookahead timer.
 */

export type MusicSection = "off" | SongId;

/** Timbre forced by the Fonoteca; null follows the visual style. */
export type TimbreOverride = "neon" | "chip" | null;

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const LOOKAHEAD_S = 0.12;
const SCHEDULER_MS = 25;
const OPEN_FILTER_HZ = 18000;
const PAUSED_FILTER_HZ = 500;

class AudioEngine {
    private ctx: AudioContext | null = null;
    private musicGain!: GainNode;
    private musicFilter!: BiquadFilterNode;
    private musicBus!: GainNode;
    private sfxGain!: GainNode;
    private noise!: AudioBuffer;

    private section: MusicSection = "off";
    private step = 0;
    private nextStepTime = 0;
    private timer: number | undefined;
    /** 0..1, raises tempo during play. */
    private intensity = 0;
    private tempoScale = 1;
    /** Old School styles: console-like timbres (triangle bass, square lead, no pad, no filter sweeps). */
    private styleChiptune = false;
    private timbreOverride: TimbreOverride = null;
    private analyser: AnalyserNode | null = null;
    /** Called each time the current song completes its 4-bar loop. */
    private loopListener: (() => void) | null = null;
    private readonly voices: Voices = {
        bass: (t, midi, duration, level) => this.bass(t, midi, duration, level),
        arp: (t, midi, duration, level) => this.arp(t, midi, duration, level),
        pad: (t, chord, duration) => this.pad(t, chord, duration),
        kick: (t) => this.kick(t),
        snare: (t) => this.snare(t),
        hat: (t, level) => this.hat(t, level),
        sweep: (t, duration) => this.sweep(t, duration),
    };

    /** Browsers only allow audio after a user gesture: call this from the first input. */
    unlock(): void {
        if (!this.ctx) {
            this.createGraph();
        }

        void this.ctx?.resume();
    }

    get unlocked(): boolean {
        return this.ctx?.state === "running";
    }

    applyVolumes(): void {
        if (!this.ctx) {
            return;
        }

        const { music, sfx } = getSettings();
        // Squared curve: perceived loudness is closer to linear across the 0-10 slider.
        this.musicGain.gain.setTargetAtTime((music / 10) ** 2 * 0.55, this.ctx.currentTime, 0.05);
        this.sfxGain.gain.setTargetAtTime((sfx / 10) ** 2 * 0.8, this.ctx.currentTime, 0.05);
    }

    setMusic(section: MusicSection): void {
        if (section === this.section) {
            return;
        }

        this.section = section;
        this.step = 0;

        if (this.ctx) {
            this.nextStepTime = this.ctx.currentTime + 0.05;
        }
    }

    setIntensity(value: number): void {
        this.intensity = Math.max(0, Math.min(1, value));
    }

    /** Muffles the music like it is playing in another room. */
    setMuffled(muffled: boolean): void {
        if (!this.ctx) {
            return;
        }

        const target = muffled ? PAUSED_FILTER_HZ : OPEN_FILTER_HZ;
        this.musicFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    }

    // ------------------------------------------------------------------ SFX

    uiMove(): void {
        this.tone({ type: "square", freq: 880, duration: 0.035, gain: 0.12 });
    }

    uiSelect(): void {
        this.tone({ type: "square", freq: 660, duration: 0.05, gain: 0.14 });
        this.tone({ type: "square", freq: 990, duration: 0.08, gain: 0.14, delay: 0.05 });
    }

    uiBack(): void {
        this.tone({ type: "square", freq: 660, duration: 0.05, gain: 0.12 });
        this.tone({ type: "square", freq: 440, duration: 0.08, gain: 0.12, delay: 0.05 });
    }

    countdown(final: boolean): void {
        if (final) {
            this.tone({ type: "sawtooth", freq: 880, duration: 0.35, gain: 0.22, cutoff: 3000 });
            this.tone({ type: "square", freq: 1320, duration: 0.3, gain: 0.08 });
        } else {
            this.tone({ type: "sine", freq: 440, duration: 0.14, gain: 0.3 });
        }
    }

    /** Pitch climbs with each food so a long run sounds like it is building up. */
    eat(foodsEaten: number): void {
        const base = 520 * 2 ** (Math.min(foodsEaten, 24) / 24);
        this.tone({ type: "square", freq: base, duration: 0.05, gain: 0.16, cutoff: 4000 });
        this.tone({ type: "square", freq: base * 1.5, duration: 0.09, gain: 0.16, delay: 0.045, cutoff: 4000 });
    }

    die(): void {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running") {
            return;
        }

        const t = ctx.currentTime;
        this.noiseBurst({ duration: 0.7, gain: 0.5, from: 4000, to: 120 });

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.6);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.62);
    }

    fanfare(): void {
        [60, 64, 67, 72, 76].forEach((midi, i) => {
            this.tone({ type: "square", freq: midiToHz(midi + 12), duration: 0.12, gain: 0.12, delay: i * 0.09, cutoff: 5000 });
        });
        this.tone({ type: "sawtooth", freq: midiToHz(84), duration: 0.6, gain: 0.1, delay: 0.45, cutoff: 3500 });
    }

    /** Rising sweep, flavored per item. */
    powerUp(kind: ItemType): void {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running") {
            return;
        }

        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "ghost" ? "sine" : kind === "scissors" ? "sawtooth" : "square";
        const [from, to] = kind === "slowmo" ? [900, 220] : [300, 1400];
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(to, t + 0.3);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.37);

        if (kind === "golden") {
            this.fanfare();
        } else if (kind === "scissors") {
            this.noiseBurst({ duration: 0.15, gain: 0.3, from: 8000, to: 2000 });
        }
    }

    /** TV channel change: a burst of static and a short blip. */
    channelSwitch(): void {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running") {
            return;
        }
        this.noiseBurst({ duration: 0.22, gain: 0.35, from: 9000, to: 1500 });
        this.tone({ type: "square", freq: 1560, duration: 0.05, gain: 0.1, delay: 0.2 });
    }

    /** Little two-note jingle for a Fonoteca unlock. */
    trackUnlocked(): void {
        this.tone({ type: "triangle", freq: midiToHz(84), duration: 0.12, gain: 0.14 });
        this.tone({ type: "triangle", freq: midiToHz(91), duration: 0.2, gain: 0.14, delay: 0.11 });
    }

    itemSpawn(): void {
        this.tone({ type: "triangle", freq: 1320, duration: 0.12, gain: 0.18 });
        this.tone({ type: "triangle", freq: 1760, duration: 0.18, gain: 0.14, delay: 0.08 });
    }

    itemExpire(): void {
        this.tone({ type: "triangle", freq: 600, duration: 0.1, gain: 0.12 });
        this.tone({ type: "triangle", freq: 400, duration: 0.14, gain: 0.1, delay: 0.08 });
    }

    effectEnd(): void {
        this.tone({ type: "sine", freq: 700, duration: 0.08, gain: 0.15 });
        this.tone({ type: "sine", freq: 500, duration: 0.12, gain: 0.15, delay: 0.07 });
    }

    levelUp(): void {
        [57, 60, 64, 69].forEach((midi, i) => {
            this.tone({ type: "sawtooth", freq: midiToHz(midi + 12), duration: 0.14, gain: 0.1, delay: i * 0.07, cutoff: 3000 });
        });
    }

    setChiptune(on: boolean): void {
        this.styleChiptune = on;
    }

    /** Fonoteca: play any song in a given timbre regardless of the visual style. */
    setTimbreOverride(override: TimbreOverride): void {
        this.timbreOverride = override;
    }

    private get chiptune(): boolean {
        return this.timbreOverride ? this.timbreOverride === "chip" : this.styleChiptune;
    }

    get currentSection(): MusicSection {
        return this.section;
    }

    onLoop(listener: (() => void) | null): void {
        this.loopListener = listener;
    }

    /** Fills `out` with the music spectrum (0-255 per bin). False before audio is unlocked. */
    getSpectrum(out: Uint8Array<ArrayBuffer>): boolean {
        if (!this.analyser) {
            return false;
        }
        this.analyser.getByteFrequencyData(out);
        return true;
    }

    /** Music drags while slow-mo runs. */
    setSlowmo(active: boolean): void {
        this.tempoScale = active ? 0.7 : 1;
    }

    pause(): void {
        this.tone({ type: "triangle", freq: 520, duration: 0.08, gain: 0.25 });
        this.tone({ type: "triangle", freq: 390, duration: 0.12, gain: 0.25, delay: 0.07 });
    }

    // ------------------------------------------------------------------ internals

    private createGraph(): void {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (!Ctor) {
            return;
        }

        const ctx = new Ctor();
        this.ctx = ctx;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 4;
        compressor.connect(ctx.destination);

        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = 0;
        this.musicGain.connect(compressor);

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.75;
        this.musicGain.connect(this.analyser);

        this.musicFilter = ctx.createBiquadFilter();
        this.musicFilter.type = "lowpass";
        this.musicFilter.frequency.value = OPEN_FILTER_HZ;
        this.musicFilter.connect(this.musicGain);

        this.musicBus = ctx.createGain();
        this.musicBus.connect(this.musicFilter);

        this.sfxGain = ctx.createGain();
        this.sfxGain.gain.value = 0;
        this.sfxGain.connect(compressor);

        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.random() * 2 - 1;
        }

        this.applyVolumes();
        this.nextStepTime = ctx.currentTime + 0.1;
        this.timer = window.setInterval(() => this.schedule(), SCHEDULER_MS);

        // Silence in background tabs; the game is paused there anyway.
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                void ctx.suspend();
            } else {
                void ctx.resume();
                this.nextStepTime = ctx.currentTime + 0.05;
            }
        });
    }

    private schedule(): void {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running" || this.timer === undefined) {
            return;
        }

        // After a long stall do not fire a burst of late notes.
        if (this.nextStepTime < ctx.currentTime - 0.2) {
            this.nextStepTime = ctx.currentTime + 0.05;
        }

        while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
            if (this.section === "off") {
                this.nextStepTime += 0.05;
                continue;
            }

            const song = SONGS[this.section];
            const bpm = this.songBpm() * this.tempoScale;
            const sixteenth = 60 / bpm / 4;
            const barIndex = Math.floor(this.step / STEPS_PER_BAR);
            song.play(this.voices, song.bars[barIndex], this.step % STEPS_PER_BAR, this.nextStepTime, sixteenth, barIndex);

            this.nextStepTime += sixteenth;
            this.step = (this.step + 1) % (STEPS_PER_BAR * song.bars.length);
            if (this.step === 0) {
                this.loopListener?.();
            }
        }
    }

    private songBpm(): number {
        if (this.section === "off") {
            return 100;
        }
        const [rest, full] = SONGS[this.section].bpm;
        return rest + (full - rest) * this.intensity;
    }

    private bass(t: number, midi: number, duration: number, level: number): void {
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        filter.type = "lowpass";

        if (this.chiptune) {
            // Triangle bass an octave up, unfiltered: the classic console bass channel.
            osc.type = "triangle";
            osc.frequency.value = midiToHz(midi + 12);
            filter.frequency.value = 20000;
            level *= 1.6;
        } else {
            osc.type = "sawtooth";
            osc.frequency.value = midiToHz(midi);
            filter.Q.value = 6;
            filter.frequency.setValueAtTime(1400, t);
            filter.frequency.exponentialRampToValueAtTime(220, t + duration);
        }
        gain.gain.setValueAtTime(level, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(filter).connect(gain).connect(this.musicBus);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    }

    private arp(t: number, midi: number, duration: number, level: number): void {
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = midiToHz(midi);
        filter.type = "lowpass";
        // Chiptune keeps the raw, buzzy square.
        filter.frequency.value = this.chiptune ? 20000 : 2400;
        gain.gain.setValueAtTime(this.chiptune ? level * 0.8 : level, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(filter).connect(gain).connect(this.musicBus);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    }

    private pad(t: number, chord: readonly number[], duration: number): void {
        // Consoles had no pad channel.
        if (this.chiptune) {
            return;
        }
        const ctx = this.ctx!;
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        filter.type = "lowpass";
        filter.frequency.value = 900;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.05, t + duration * 0.3);
        gain.gain.linearRampToValueAtTime(0.0001, t + duration);
        filter.connect(gain).connect(this.musicBus);

        for (const midi of chord) {
            // Two detuned saws per note give the classic wide synth pad.
            for (const detune of [-8, 8]) {
                const osc = ctx.createOscillator();
                osc.type = "sawtooth";
                osc.frequency.value = midiToHz(midi);
                osc.detune.value = detune;
                osc.connect(filter);
                osc.start(t);
                osc.stop(t + duration + 0.05);
            }
        }
    }

    private kick(t: number): void {
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // Triangle kick: the pitch-swept triangle drum of 8-bit consoles.
        osc.type = this.chiptune ? "triangle" : "sine";
        osc.frequency.setValueAtTime(this.chiptune ? 220 : 150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain).connect(this.musicBus);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    private snare(t: number): void {
        this.noiseHit(t, { type: "bandpass", freq: 1800, gain: 0.32, decay: 0.16, bus: this.musicBus });
    }

    /** Static rising into the next loop (channel-change feel). */
    private sweep(t: number, duration: number): void {
        const ctx = this.ctx!;
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = this.noise;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(8000, t + duration);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + duration * 0.9);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        source.connect(filter).connect(gain).connect(this.musicBus);
        source.start(t, Math.random() * 0.5);
        source.stop(t + duration + 0.02);
    }

    private hat(t: number, level: number): void {
        this.noiseHit(t, { type: "highpass", freq: 7000, gain: level, decay: 0.04, bus: this.musicBus });
    }

    private noiseHit(
        t: number,
        { type, freq, gain: level, decay, bus }: { type: BiquadFilterType; freq: number; gain: number; decay: number; bus: AudioNode },
    ): void {
        const ctx = this.ctx!;
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = this.noise;
        filter.type = type;
        filter.frequency.value = freq;
        gain.gain.setValueAtTime(level, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
        source.connect(filter).connect(gain).connect(bus);
        source.start(t, Math.random() * 0.5);
        source.stop(t + decay + 0.02);
    }

    private noiseBurst({ duration, gain: level, from, to }: { duration: number; gain: number; from: number; to: number }): void {
        const ctx = this.ctx!;
        const t = ctx.currentTime;
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = this.noise;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(from, t);
        filter.frequency.exponentialRampToValueAtTime(to, t + duration);
        gain.gain.setValueAtTime(level, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        source.connect(filter).connect(gain).connect(this.sfxGain);
        source.start(t);
        source.stop(t + duration + 0.02);
    }

    private tone({
        type,
        freq,
        duration,
        gain: level,
        delay = 0,
        cutoff,
    }: {
        type: OscillatorType;
        freq: number;
        duration: number;
        gain: number;
        delay?: number;
        cutoff?: number;
    }): void {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running") {
            return;
        }

        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(level, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        let node: AudioNode = osc;
        if (cutoff) {
            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = cutoff;
            node = osc.connect(filter);
        }

        node.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    }
}

export const audio = new AudioEngine();
