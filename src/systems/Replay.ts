import { GameState } from "./GameState";
import { MAX_TIER } from "../data/foods";

/**
 * Run verification.
 *
 * WHAT THIS DOES AND DOESN'T PROVE
 *
 * The score is a pure function of *economic* events — what you dropped, merged
 * and fed — not of the physics. So the server can re-run the whole economy
 * from the daily seed and recompute the score exactly, without simulating a
 * single collision. That kills the attack that actually matters: editing the
 * score, or inventing food.
 *
 * Concretely, replaying the event log proves:
 *   - the drops match the ones that seed hands out, in order;
 *   - every merge consumed two real foods of that tier that you actually had;
 *   - every feed matched the craving the seed produced at that moment;
 *   - the score recomputes to exactly the number submitted.
 *
 * What it can NOT prove is that the physics would have permitted those merges —
 * a determined cheat could claim a perfectly-played log. But they cannot exceed
 * what that seed's food can possibly produce, so the ceiling is the theoretical
 * best for the day rather than an arbitrary number. Full physics replay would
 * close that too, but Matter.js is not deterministic across engines at variable
 * timestep, so it would be a much bigger and more fragile undertaking.
 */

export const REPLAY_VERSION = "v1";

/** A plain object rather than a `const enum`: those get inlined at compile
 *  time and don't survive the copy into the Deno edge function. */
export const Ev = {
  /** arg 0 = from the queue, arg 1 = putting the pocketed food back. */
  Drop: 0,
  Merge: 1,
  Feed: 2,
  Stash: 3,
  Undo: 4,
} as const;

/** [kind, arg] — arg is the tier for Merge/Feed/Stash, or the Drop source. */
export type ReplayEvent = [number, number];

export interface VerifyResult {
  ok: boolean;
  score: number;
  feeds: number;
  drops: number;
  biggestTier: number;
  reason?: string;
}

/** Hard ceiling so a malicious log can't pin the server in a long loop. */
const MAX_EVENTS = 40000;

/**
 * Re-run an event log against a fresh GameState seeded from `dailyKey`, and
 * report the score it genuinely produces. Bag counts stand in for the physical
 * pile: the exact positions don't affect scoring, only what exists.
 */
export function verifyRun(
  dailyKey: string,
  events: ReplayEvent[],
  claimedScore: number
): VerifyResult {
  const fail = (reason: string, s: GameState): VerifyResult => ({
    ok: false,
    score: s.score,
    feeds: s.totalFeeds,
    drops: s.totalDrops,
    biggestTier: s.biggestTier,
    reason,
  });

  const state = new GameState(dailyKey);
  if (!Array.isArray(events)) return fail("no event log", state);
  if (events.length > MAX_EVENTS) return fail("event log too long", state);

  /** How many foods of each tier are in the bin. */
  const bin = new Map<number, number>();
  const take = (tier: number, n: number): boolean => {
    const have = bin.get(tier) ?? 0;
    if (have < n) return false;
    bin.set(tier, have - n);
    return true;
  };
  const give = (tier: number, n: number) => bin.set(tier, (bin.get(tier) ?? 0) + n);

  // Undo needs to put the exact food back, so remember the last drop.
  let lastDrop: { tier: number; fromPocket: boolean } | null = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!Array.isArray(ev) || ev.length < 2) return fail(`event ${i} malformed`, state);
    const [kind, arg] = ev;

    switch (kind) {
      case Ev.Drop: {
        // A pocketed food re-entering the bin doesn't consume the queue.
        if (arg === 1) {
          const p = state.takePocket();
          if (!p) return fail(`event ${i}: unstash with empty pocket`, state);
          give(p.tier, 1);
          state.noteTier(p.tier);
          lastDrop = { tier: p.tier, fromPocket: true };
        } else {
          const spec = state.takeDrop();
          give(spec.tier, 1);
          state.noteTier(spec.tier);
          lastDrop = { tier: spec.tier, fromPocket: false };
        }
        break;
      }

      case Ev.Merge: {
        if (arg < 1 || arg >= MAX_TIER) return fail(`event ${i}: bad merge tier`, state);
        // Two of a tier become one of the next — the only way food grows.
        if (!take(arg, 2)) return fail(`event ${i}: merged ${arg}s you didn't have`, state);
        give(arg + 1, 1);
        state.addMergeScore(arg + 1);
        state.noteTier(arg + 1);
        lastDrop = null; // the board moved; the last drop is no longer undoable
        break;
      }

      case Ev.Feed: {
        if (!take(arg, 1)) return fail(`event ${i}: fed a ${arg} you didn't have`, state);
        const result = state.feed(state.craving.type, arg);
        if (!result) return fail(`event ${i}: fed ${arg}, craving was ${state.craving.tier}`, state);
        lastDrop = null;
        break;
      }

      case Ev.Stash: {
        if (!take(arg, 1)) return fail(`event ${i}: stashed a ${arg} you didn't have`, state);
        if (!state.stash({ type: state.craving.type, tier: arg })) {
          give(arg, 1);
          return fail(`event ${i}: stash not affordable`, state);
        }
        lastDrop = null;
        break;
      }

      case Ev.Undo: {
        if (state.undosLeft <= 0) return fail(`event ${i}: out of undos`, state);
        if (!lastDrop) return fail(`event ${i}: nothing to undo`, state);
        if (!take(lastDrop.tier, 1)) return fail(`event ${i}: undo target missing`, state);
        if (lastDrop.fromPocket) {
          state.pocket = { type: state.craving.type, tier: lastDrop.tier };
          state.undosLeft--;
        } else {
          state.returnDrop({ type: state.craving.type, tier: lastDrop.tier });
        }
        lastDrop = null;
        break;
      }

      default:
        return fail(`event ${i}: unknown kind ${kind}`, state);
    }
  }

  const out: VerifyResult = {
    ok: state.score === claimedScore,
    score: state.score,
    feeds: state.totalFeeds,
    drops: state.totalDrops,
    biggestTier: state.biggestTier,
  };
  if (!out.ok) out.reason = `score mismatch: replay says ${state.score}, run claimed ${claimedScore}`;
  return out;
}
