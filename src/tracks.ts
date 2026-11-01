import type { SongId } from "./audio/songs";
import { isTrackUnlocked, unlockTrack } from "./storage";
import { isSurprise } from "./theme";

/**
 * Fonoteca catalog. An entry is a song in a timbre: the menu and game songs appear twice
 * (synthwave and chiptune), the two newer songs once in their original synthwave timbre.
 */
export type TrackId = "title-neon" | "title-8bit" | "grid-neon" | "grid-8bit" | "overdrive" | "surf";

export interface Track {
    id: TrackId;
    song: SongId;
    timbre: "neon" | "chip";
    /** Available from the start; the others unlock by playing. */
    free?: boolean;
}

export const TRACKS: readonly Track[] = [
    { id: "title-neon", song: "title", timbre: "neon", free: true },
    { id: "title-8bit", song: "title", timbre: "chip", free: true },
    { id: "grid-neon", song: "grid", timbre: "neon" },
    { id: "grid-8bit", song: "grid", timbre: "chip" },
    { id: "overdrive", song: "overdrive", timbre: "neon" },
    { id: "surf", song: "surf", timbre: "neon" },
];

/** Level from which the in-game music switches to Overdrive. */
export const OVERDRIVE_LEVEL = 5;

export function isUnlocked(track: Track): boolean {
    return track.free === true || isTrackUnlocked(track.id);
}

/** In-game song for the current situation. */
export function gameSong(level: number): SongId {
    if (level >= OVERDRIVE_LEVEL) {
        return "overdrive";
    }
    return isSurprise() ? "surf" : "grid";
}

/**
 * Unlocks tracks earned by the current match state: the game theme of the style being played
 * (even while Surprise plays its own song), plus the special song playing now.
 * Returns the newly unlocked ones, so the game can announce them.
 */
export function unlockEarned(song: SongId, pixel: boolean): TrackId[] {
    const ids: TrackId[] = [pixel ? "grid-8bit" : "grid-neon"];
    if (song === "overdrive" || song === "surf") {
        ids.push(song);
    }
    return ids.filter((id) => unlockTrack(id));
}
