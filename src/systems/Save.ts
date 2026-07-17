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

interface SaveData {
  name: string;
  best: number;
}

const DEFAULTS: SaveData = { name: "", best: 0 };

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
  /** Store a finished run. Returns true if it beat the previous best. */
  recordScore(score: number): boolean {
    const data = read();
    if (score <= data.best) return false;
    data.best = score;
    write(data);
    return true;
  },
};
