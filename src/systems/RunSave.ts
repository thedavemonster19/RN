import { ModeId } from "./Modes";
import { ReplayEvent, REPLAY_VERSION } from "./Replay";

/**
 * Persistence for the run in progress, so closing or reloading the page
 * offers "Continue" instead of eating the game.
 *
 * WHAT IS STORED: the run's identity (seed / daily key / mode), the replay
 * event log, and a visual snapshot of the pile (x, y, tier per food). The
 * ECONOMY is deliberately not stored — on resume it is rebuilt by replaying
 * the log through Replay.restoreRun, the same loop the server verifies with.
 * That has two payoffs: the resumed RNG sits at exactly the right position,
 * and a tampered save simply fails to replay (and the grown log would be
 * rejected by the server at submission anyway), so this adds no new trust in
 * the client. Only the pile snapshot is taken at face value, and it is
 * visual: what exists economically is decided by the log.
 *
 * Versioned by REPLAY_VERSION: a save from an older economy cannot replay
 * correctly, so it is dropped rather than restored wrong.
 */
export interface StoredRun {
  v: string;
  seed: number;
  dailyKey: string | null;
  mode: ModeId;
  events: ReplayEvent[];
  /** [x, y, tier] for every food body in the bin at save time. */
  pile: [number, number, number][];
  savedAt: number;
}

const KEY = "monster-active-run";

/** localStorage can be absent or full (private mode); persistence is a
 *  nicety, so every failure is swallowed. */
export const RunSave = {
  save(run: StoredRun): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(run));
    } catch {
      /* not available — play on without persistence */
    }
  },

  load(): StoredRun | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const run = JSON.parse(raw) as StoredRun;
      if (run.v !== REPLAY_VERSION) {
        this.clear(); // saved under an old economy — cannot replay correctly
        return null;
      }
      if (!Array.isArray(run.events) || !Array.isArray(run.pile)) return null;
      return run;
    } catch {
      return null;
    }
  },

  exists(): boolean {
    return this.load() !== null;
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
