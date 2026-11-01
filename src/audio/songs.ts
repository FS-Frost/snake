/**
 * The soundtrack as data plus a per-step arrangement. Every song is a 4-bar loop of 16 steps per bar;
 * the engine schedules the steps and calls `play` with synth voices that already know the timbre
 * (synthwave or chiptune), so a song is written once and sounds right in every style.
 */

export type SongId = "title" | "grid" | "overdrive" | "surf";

export interface Bar {
    /** MIDI note of the bass root. */
    bass: number;
    /** Three chord tones (MIDI). */
    chord: [number, number, number];
}

/** Synth voices the engine provides to songs. Times are AudioContext seconds. */
export interface Voices {
    bass(t: number, midi: number, duration: number, level: number): void;
    arp(t: number, midi: number, duration: number, level: number): void;
    pad(t: number, chord: readonly number[], duration: number): void;
    kick(t: number): void;
    snare(t: number): void;
    hat(t: number, level: number): void;
    /** Rising burst of static, used as a fill. */
    sweep(t: number, duration: number): void;
}

export interface Song {
    /** Tempo at rest and at full intensity (long snake, Fonoteca "intense"). */
    bpm: [number, number];
    bars: readonly Bar[];
    /** Plays step `s` (0-15) of `bar`. `sixteenth` is the step length in seconds. */
    play(v: Voices, bar: Bar, s: number, t: number, sixteenth: number, barIndex: number): void;
}

export const STEPS_PER_BAR = 16;

/** Am - F - C - G. */
const A_MINOR: readonly Bar[] = [
    { bass: 45, chord: [57, 60, 64] },
    { bass: 41, chord: [53, 57, 60] },
    { bass: 48, chord: [55, 60, 64] },
    { bass: 43, chord: [55, 59, 62] },
];

export const SONGS: Record<SongId, Song> = {
    /** Title screen: slow pad, quarter-note bass and a soft arpeggio. */
    title: {
        bpm: [96, 112],
        bars: A_MINOR,
        play(v, bar, s, t, sixteenth) {
            if (s === 0) {
                v.pad(t, bar.chord, sixteenth * STEPS_PER_BAR);
            }
            if (s % 4 === 0) {
                v.bass(t, bar.bass, sixteenth * 3, 0.16);
            }
            if (s % 2 === 0) {
                v.arp(t, bar.chord[(s / 2) % 3] + 12, sixteenth * 1.5, 0.035);
            }
        },
    },

    /** In-game: driving octave bass, 16th arpeggio and four-on-the-floor drums. */
    grid: {
        bpm: [108, 134],
        bars: A_MINOR,
        play(v, bar, s, t, sixteenth) {
            if (s % 2 === 0) {
                v.bass(t, bar.bass + (s % 4 === 2 ? 12 : 0), sixteenth * 1.6, 0.22);
            }
            v.arp(t, bar.chord[s % 3] + (s >= 8 ? 12 : 0), sixteenth * 0.9, 0.045);
            if (s % 4 === 0) v.kick(t);
            if (s === 4 || s === 12) v.snare(t);
            if (s % 2 === 1) v.hat(t, s % 4 === 3 ? 0.09 : 0.05);
        },
    },

    /** Level 5+: D minor, relentless 16th bass, four-note arpeggio and a busier kit. */
    overdrive: {
        bpm: [128, 150],
        bars: [
            { bass: 38, chord: [50, 53, 57] },
            { bass: 46, chord: [53, 58, 62] },
            { bass: 48, chord: [55, 60, 64] },
            { bass: 45, chord: [52, 57, 61] },
        ],
        play(v, bar, s, t, sixteenth) {
            v.bass(t, bar.bass + (s % 2 === 1 ? 12 : 0), sixteenth * 0.9, 0.18);
            const pattern = [bar.chord[0], bar.chord[1], bar.chord[2], bar.chord[0] + 12];
            v.arp(t, pattern[s % 4] + (s >= 8 ? 12 : 0), sixteenth * 0.8, 0.05);
            if (s % 4 === 0 || s === 14) v.kick(t);
            if (s === 4 || s === 12) v.snare(t);
            v.hat(t, s % 2 === 1 ? 0.08 : 0.03);
        },
    },

    /** Surprise mode: playful major-key groove, syncopated bass, call-and-response lead, static fill. */
    surf: {
        bpm: [116, 138],
        bars: [
            { bass: 41, chord: [57, 60, 65] },
            { bass: 43, chord: [59, 62, 67] },
            { bass: 40, chord: [55, 59, 64] },
            { bass: 45, chord: [57, 60, 64] },
        ],
        play(v, bar, s, t, sixteenth, barIndex) {
            if ([0, 3, 6, 8, 11, 14].includes(s)) {
                v.bass(t, bar.bass + (s === 6 || s === 14 ? 12 : 0), sixteenth * 1.4, 0.2);
            }
            // Call: rising tones on even steps. Response: falling an octave up on odd steps.
            if (s < 8 && s % 2 === 0) {
                v.arp(t, bar.chord[(s / 2) % 3] + 12, sixteenth * 1.2, 0.05);
            } else if (s >= 8 && s % 2 === 1) {
                v.arp(t, bar.chord[2 - ((s - 9) / 2) % 3] + 24, sixteenth * 0.9, 0.04);
            }
            if (s === 0 || s === 7 || s === 8) v.kick(t);
            if (s === 4 || s === 12) v.snare(t);
            if (s % 4 === 2) v.hat(t, 0.08);
            // Channel-change static closing the loop.
            if (barIndex === 3 && s === 12) v.sweep(t, sixteenth * 4);
        },
    },
};
