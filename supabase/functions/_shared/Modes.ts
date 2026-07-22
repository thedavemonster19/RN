// GENERATED — do not edit. Copied from src/systems/Modes.ts by scripts/sync-edge-shared.mjs.
// Edit the original and re-run `npm run sync:edge`.

import { ModId, MODS } from "./Modifiers.ts";

/**
 * Permanent game modes.
 *
 * The daily challenge rolls two random modifiers from the date. Modes take the
 * same modifiers and make them a standing choice instead: pick one, play it
 * whenever you like, and it has its own leaderboard.
 *
 * Each mode gets its OWN board because modes are not balanced against each
 * other and never can be — Big Appetite and Heavy Rain change what a run is
 * worth. Pooling them into one table would just rank the most generous mode,
 * and every serious player would be forced into it. Separate boards mean a
 * mode can be interesting without having to be fair against the others.
 *
 * DEPENDENCY-FREE on purpose, like GameState and Modifiers: this file is copied
 * into the verify-run edge function so the server derives exactly the same
 * modifier set the client played with. Importing anything with a DOM or Phaser
 * dependency here breaks server-side verification.
 *
 * KNOWN LIMIT — feel modes are self-declared.
 *
 * Verification replays the ECONOMY, not the physics (see Replay.ts). The four
 * economy modes (Big Appetite, Double Drop, Impatient, Heavy Rain) change what
 * a run scores, so the server catches a run submitted under the wrong one —
 * measured: a Big Appetite log replayed as classic scores 91 against its real
 * 34,121, and is rejected.
 *
 * The four FEEL modes (Low Gravity, Swinging Claw, Windy, Cramped Bin) change
 * only physics, input or the fail line. Their event logs are byte-for-byte
 * valid as classic logs — measured identical at 32,937 — so the server
 * genuinely cannot tell them apart. A player could therefore play Low Gravity,
 * where placement is easier, and submit the run to the Classic board.
 *
 * This is bounded rather than unlimited: the seed still caps how much food
 * exists, so a feel mode changes how EASILY a player approaches that ceiling,
 * not the ceiling itself. Closing it properly needs either deterministic
 * physics replay (Matter.js is not deterministic across engines at a variable
 * timestep) or giving each feel mode its own economic fingerprint, which would
 * change game balance. Neither should happen quietly.
 */
export type ModeId = "classic" | ModId;

export interface ModeDef {
  id: ModeId;
  name: string;
  desc: string;
  /** Modifiers in force. Empty for classic. */
  mods: ModId[];
}

/**
 * Classic first — it is the default and the one whose board is comparable with
 * the game's history. The rest are one mode per modifier, in a deliberate
 * order: the gentler twists first so the mode list reads as a difficulty ramp
 * rather than an alphabetical dump.
 */
export const MODES: ModeDef[] = [
  {
    id: "classic",
    name: "Classic",
    desc: "The pure game. No twists.",
    mods: [],
  },
  ...(
    [
      "floaty",
      "swing",
      "windy",
      "feast",
      "double",
      "bigdrops",
      "rush",
      "cramped",
    ] as ModId[]
  ).map((id) => ({
    id: id as ModeId,
    name: MODS[id].name,
    desc: MODS[id].desc,
    mods: [id],
  })),
];

const BY_ID = new Map<string, ModeDef>(MODES.map((m) => [m.id, m]));

export function isModeId(value: unknown): value is ModeId {
  return typeof value === "string" && BY_ID.has(value);
}

/** The modifiers a mode plays with. Unknown ids fall back to classic, so a
 *  tampered or future mode id can never invent a scoring rule. */
export function modeMods(id: ModeId | null | undefined): ModId[] {
  if (!id) return [];
  return BY_ID.get(id)?.mods ?? [];
}

export function modeName(id: ModeId | null | undefined): string {
  if (!id) return "Classic";
  return BY_ID.get(id)?.name ?? "Classic";
}

export function modeDef(id: ModeId): ModeDef {
  return BY_ID.get(id) ?? MODES[0];
}
