/**
 * Copies the pure game-logic modules into the edge function's _shared folder,
 * rewriting imports for Deno (which needs explicit .ts extensions).
 *
 * The point is that the server scores a run with the SAME code the client ran.
 * Hand-copying would let the two drift apart silently, and a scoring rule that
 * differs by one point between client and server would reject every honest
 * run. So this is mechanical, and the copies are generated — never edited.
 *
 * Run: npm run sync:edge   (and re-run after touching any of these files)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = "supabase/functions/_shared";
const FILES = [
  ["src/systems/Rng.ts", "Rng.ts"],
  ["src/data/foods.ts", "foods.ts"],
  ["src/data/milestones.ts", "milestones.ts"],
  ["src/systems/Modifiers.ts", "Modifiers.ts"],
  ["src/systems/Modes.ts", "Modes.ts"],
  ["src/systems/GameState.ts", "GameState.ts"],
  ["src/systems/Replay.ts", "replay.ts"],
];

/**
 * Everything lands in one flat folder, so every relative import becomes
 * "./name.ts" — Deno requires the explicit extension.
 *
 * Deliberately GENERIC rather than a list of known module names. It used to be
 * a hardcoded list, and adding Modes.ts to FILES without also adding its
 * rewrite rule shipped `import ... from "./Modes"` to the edge function, where
 * it failed at deploy time with "Module not found ... Maybe add a '.ts'
 * extension". A rule you must remember to update is a rule that will be
 * forgotten.
 *
 * Matches any relative specifier whose last segment has no extension, so
 * "../data/foods" and "./Rng" both collapse to "./foods.ts" and "./Rng.ts",
 * while an already-correct "./GameState.ts" is left alone (it contains a dot,
 * so the final group cannot match) and bare/jsr specifiers are untouched.
 */
const RELATIVE_IMPORT = /(from\s+")(?:\.\.?\/)(?:[\w.-]+\/)*([\w-]+)(")/g;

mkdirSync(OUT, { recursive: true });

for (const [src, dest] of FILES) {
  let code = readFileSync(src, "utf8");
  code = code.replace(RELATIVE_IMPORT, '$1./$2.ts$3');
  const banner =
    `// GENERATED — do not edit. Copied from ${src} by scripts/sync-edge-shared.mjs.\n` +
    `// Edit the original and re-run \`npm run sync:edge\`.\n\n`;
  writeFileSync(`${OUT}/${dest}`, banner + code);
  console.log(`  ${src} -> ${OUT}/${dest}`);
}
// Verify rather than trust: a relative import without an extension deploys
// fine locally and only fails on Supabase's bundler, minutes later and with a
// far less obvious message. Catch it here instead.
let bad = 0;
for (const [, dest] of FILES) {
  const out = readFileSync(`${OUT}/${dest}`, "utf8");
  for (const m of out.matchAll(/from\s+"(\.[^"]*)"/g)) {
    if (!m[1].endsWith(".ts")) {
      console.error(`  BAD IMPORT in ${dest}: ${m[1]} — missing .ts extension`);
      bad++;
    }
  }
}
if (bad) {
  console.error(`edge sync FAILED: ${bad} import(s) would break the deploy`);
  process.exit(1);
}
console.log("edge shared modules synced");
