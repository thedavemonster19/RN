/**
 * Economy simulator for difficulty tuning — NOT part of the game build.
 *
 *   node scripts/balance-sim.mjs
 *
 * Mirrors GameState's economy (craving roll, drop roll, feed/merge/clear
 * scoring, growth) with the knobs exposed as parameters, and models the BIN
 * as area with a packing factor calibrated to the one physics measurement we
 * trust: 52 uniform drops fill the fresh bin (PACK ≈ 0.547 of 280x320).
 *
 * The bot plays optimistically: it can always merge available material and
 * always feeds the moment the craved tier exists. Real players do worse
 * (physics adjacency, misdrops), so absolute scores here are a CEILING; the
 * value of the sim is comparing settings against each other and seeing when
 * even a perfect player dies.
 */

const TIER_AREAS = [9, 13, 18, 25, 36, 51, 72, 102].map((r) => Math.PI * r * r);
const MAX_TIER = 8;
const MAX_DROP_TIER = 4;
const MIN_CRAVING_TIER = 3;
const PACK = (52 * avgDropArea()) / (280 * 320);

function avgDropArea() {
  return (TIER_AREAS[0] + TIER_AREAS[1] + TIER_AREAS[2] + TIER_AREAS[3]) / 4;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function growthReq(i) {
  return 15 + Math.round(i * i);
}

function simulate(seed, knobs) {
  const {
    capRamp, // per-milestone climb of the craving ceiling (live: 0.6)
    biasBase, // pow() exponent at m0 (live: 0.62)
    biasPer, // exponent shrink per milestone (live: 0.02)
    biasMin, // exponent floor (live: 0.34)
    lineStep, // danger-line descent per milestone, px (live: 6)
    feedBase, // flat part of feed pay (live: 60)
    maxDrops, // safety stop so an immortal config still terminates
  } = knobs;

  const rng = mulberry32(seed);
  const rollCraving = (m) => {
    const low = MIN_CRAVING_TIER;
    const cap = Math.min(4 + Math.floor(m * capRamp), MAX_TIER);
    const span = Math.max(1, cap - low + 1);
    const bias = Math.max(biasMin, biasBase - m * biasPer);
    const roll = Math.pow(rng(), bias);
    return low + Math.min(span - 1, Math.floor(span * roll));
  };
  const rollDrop = () => {
    const r = rng();
    return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : MAX_DROP_TIER;
  };
  const capacity = (m) => {
    const line = Math.min(150 + m * lineStep, 470 - 262);
    return PACK * 280 * (470 - line);
  };

  let score = 0;
  let growth = 0;
  let milestone = 0;
  let craving = rollCraving(0);
  const queue = [];
  for (let i = 0; i < 3; i++) queue.push(rollCraving(0));
  const bin = new Array(MAX_TIER + 1).fill(0); // count per tier
  let cravingAge = 0;
  let drops = 0;
  let dropsSinceClear = 0;
  let feeds = 0;

  const area = () => bin.reduce((s, n, t) => s + n * (TIER_AREAS[t - 1] || 0), 0);
  const freshness = () => {
    const grace = Math.ceil(2 ** (craving - 1) / 3) + 2;
    return Math.max(0, Math.min(1, 1 - Math.max(0, cravingAge - grace) / (grace * 2)));
  };

  // Merge toward the craved tier, at most `budget` merges — the realism
  // knob. Perfect play (infinite budget) is provably immortal here; what
  // kills real players is that merging is rate-limited by physics: pieces
  // must touch, buried ones must be dug out, and every drop of staging
  // invites the queue's next disruption. Returns true when bin[craving] > 0.
  const assemble = (budget) => {
    for (let guard = 0; guard < budget; guard++) {
      if (bin[craving] > 0) return true;
      // find the biggest tier below the craving with a pair to merge
      let t = -1;
      for (let k = craving - 1; k >= 1; k--) {
        if (bin[k] >= 2) {
          t = k;
          break;
        }
      }
      if (t < 0) return false;
      bin[t] -= 2;
      bin[t + 1]++;
      score += (t + 1) * 8;
    }
    return bin[craving] > 0;
  };

  while (drops < maxDrops) {
    if (assemble(knobs.mergesPerDrop)) {
      // feed
      bin[craving]--;
      feeds++;
      const fresh = Math.round(craving * 40 * freshness());
      score += craving * 40 + fresh + milestone * 20 + feedBase;
      growth += craving * 2;
      while (growth >= growthReq(milestone)) {
        growth -= growthReq(milestone);
        milestone++;
        score += 180 + milestone * 30;
      }
      if (area() === 0) {
        score += Math.max(100, Math.min(1200, dropsSinceClear * 40));
        dropsSinceClear = 0;
      }
      craving = queue.shift();
      queue.push(rollCraving(milestone));
      cravingAge = 0;
      continue;
    }
    // must drop for material
    const t = rollDrop();
    bin[t]++;
    drops++;
    dropsSinceClear++;
    cravingAge++;
    score += 2 + t;
    if (area() > capacity(milestone)) {
      return { score, milestone, drops, feeds, died: true };
    }
  }
  return { score, milestone, drops, feeds, died: false };
}

function stats(name, knobs, runs = 3000) {
  const rng = mulberry32(0xbeef);
  const scores = [];
  const deaths = [];
  let immortal = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulate((rng() * 2 ** 32) >>> 0, knobs);
    scores.push(r.score);
    if (r.died) deaths.push(r.milestone);
    else immortal++;
  }
  scores.sort((a, b) => a - b);
  deaths.sort((a, b) => a - b);
  const mean = Math.round(scores.reduce((a, b) => a + b, 0) / runs);
  const q = (p) => scores[Math.floor(p * runs)];
  const dq = (p) => (deaths.length ? deaths[Math.floor(p * deaths.length)] : "-");
  console.log(
    `${name.padEnd(26)} mean=${String(mean).padStart(7)}  ` +
      `p25=${String(q(0.25)).padStart(7)}  med=${String(q(0.5)).padStart(7)}  ` +
      `p75=${String(q(0.75)).padStart(7)}  deathMilestone(med)=${dq(0.5)}  ` +
      `immortal=${((immortal / runs) * 100).toFixed(1)}%`
  );
}

const LIVE = {
  capRamp: 0.6,
  biasBase: 0.62,
  biasPer: 0.02,
  biasMin: 0.34,
  lineStep: 6,
  feedBase: 60,
  maxDrops: 3000,
  mergesPerDrop: 3,
};

console.log(`PACK=${PACK.toFixed(3)}  (calibrated: 52 drops fill 280x320)`);
console.log("--- merge-rate sweep under LIVE settings ---");
for (const k of [2, 3, 4, 6, 10]) {
  stats(`live, ${k} merges/drop`, { ...LIVE, mergesPerDrop: k });
}
console.log("--- candidate settings at 3 merges/drop ---");
stats("A live", LIVE);
stats("B ramp .6->.8 biasMin .28", { ...LIVE, capRamp: 0.8, biasMin: 0.28 });
stats("C B + line 6->9", { ...LIVE, capRamp: 0.8, biasMin: 0.28, lineStep: 9 });
stats("D B + line 6->12", { ...LIVE, capRamp: 0.8, biasMin: 0.28, lineStep: 12 });
stats("E ramp 1.0 + line 9", { ...LIVE, capRamp: 1.0, biasMin: 0.28, lineStep: 9 });
console.log("--- the same candidates at 4 merges/drop (better player) ---");
stats("A live", { ...LIVE, mergesPerDrop: 4 });
stats("B ramp .8", { ...LIVE, capRamp: 0.8, biasMin: 0.28, mergesPerDrop: 4 });
stats("C B + line 9", { ...LIVE, capRamp: 0.8, biasMin: 0.28, lineStep: 9, mergesPerDrop: 4 });
stats("E ramp 1.0 + line 9", { ...LIVE, capRamp: 1.0, biasMin: 0.28, lineStep: 9, mergesPerDrop: 4 });
