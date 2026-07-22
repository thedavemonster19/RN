/**
 * Everything the player keeps between runs: right now their monster's name and
 * best score, later the leaderboard handle and settings.
 *
 * Every access is wrapped in try/catch on purpose — localStorage throws in
 * private mode and inside some iOS webviews, and a storage failure must never
 * take the game down with it. Failing to save is always better than crashing.
 */
const KEY = "monster-muncher/v1";

export const NAME_MAX = 12;

/** A finished run, kept for the profile screen. */
export interface RunRecord {
  score: number;
  milestone: number;
  feeds: number;
  drops: number;
  biggestTier: number;
}

interface SaveData {
  name: string;
  best: number;
  /** Stats of the single best run so far. */
  bestRun: RunRecord | null;
  runs: number;
  /** Best daily-challenge score, keyed by date (YYYY-MM-DD). */
  daily: Record<string, number>;
  /** Best score per permanent mode, keyed by mode id. */
  modes: Record<string, number>;
}

const DEFAULTS: SaveData = {
  name: "",
  best: 0,
  bestRun: null,
  runs: 0,
  daily: {},
  modes: {},
};

/** Names offered when the player can't be bothered to think of one. */
const SUGGESTIONS = [
  "Blobby",
  "Nibbles",
  "Chomp",
  "Munchie",
  "Gulp",
  "Snax",
  "Grub",
  "Noms",
];

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — play on without saving */
  }
}

/** Collapse whitespace, trim, and cap the length. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function suggestName(): string {
  return SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
}

export const Save = {
  get name(): string {
    return read().name;
  },
  set name(value: string) {
    const data = read();
    data.name = cleanName(value);
    write(data);
  },
  get named(): boolean {
    return read().name.length > 0;
  },
  get best(): number {
    return read().best;
  },
  get bestRun(): RunRecord | null {
    return read().bestRun;
  },
  get runs(): number {
    return read().runs;
  },

  /** Best score for a given daily challenge, or 0 if unplayed. */
  dailyBest(key: string): number {
    return read().daily[key] ?? 0;
  },

  /** This device's best score in a given mode, or 0 if unplayed. */
  modeBest(mode: string): number {
    return read().modes[mode] ?? 0;
  },

  /**
   * Fold an account's cloud progress into this device's save.
   *
   * Needed because the save is per-DEVICE while an account is not: signing in
   * on a second device showed that device's history, so the same account
   * displayed two different all-time bests. Progress only ever moves UP here —
   * we take the max of each number rather than overwriting — so syncing can
   * never cost a player a run they made offline on this device.
   *
   * The monster's name is the one exception: it is a preference, not a score,
   * so the account's name wins whenever it has one.
   */
  mergeCloud(cloud: {
    monster?: string;
    best?: number;
    bestRun?: RunRecord | null;
    runs?: number;
  }): void {
    const data = read();
    if (cloud.monster) data.name = cleanName(cloud.monster);
    if ((cloud.best ?? 0) > data.best) {
      data.best = cloud.best ?? 0;
      // Keep the record consistent: the stats must describe the best score.
      if (cloud.bestRun) data.bestRun = cloud.bestRun;
    }
    if ((cloud.runs ?? 0) > data.runs) data.runs = cloud.runs ?? 0;
    write(data);
  },

  /**
   * Store a finished run. Returns true if it beat the previous best.
   * `dailyKey` records it against that day's challenge as well.
   */
  recordRun(run: RunRecord, dailyKey: string | null, mode = "classic"): boolean {
    const data = read();
    data.runs++;
    if (dailyKey && run.score > (data.daily[dailyKey] ?? 0)) {
      data.daily[dailyKey] = run.score;
    }
    // A daily run belongs to the daily board, not to a mode's board.
    if (!dailyKey && run.score > (data.modes[mode] ?? 0)) {
      data.modes[mode] = run.score;
    }
    const isBest = run.score > data.best;
    if (isBest) {
      data.best = run.score;
      data.bestRun = run;
    }
    write(data);
    return isBest;
  },
};
