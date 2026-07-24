/**
 * Reproduce the rapid-drop freeze: enter the game, then hammer taps into the
 * bin area as fast as a spamming player would, and afterwards check whether
 * the game loop is still alive (rAF advancing, page responsive).
 *
 *   node scripts/probe-freeze.mjs <out.png> [tapCount] [gapMs]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const out = process.argv[2] || "freeze-probe.png";
const tapCount = Number(process.argv[3] || 24);
const gapMs = Number(process.argv[4] || 90);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--no-sandbox",
  "--hide-scrollbars",
  "--use-gl=swiftshader",
  "--enable-unsafe-swiftshader",
  "--mute-audio",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/claude-shoot-profile",
  "--window-size=440,800",
  "about:blank",
]);

let ws;
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res) => {
    const n = ++id;
    pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

try {
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  };
  const errors = [];
  await send("Runtime.enable");
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(
        m.params.exceptionDetails.text +
          " " +
          (m.params.exceptionDetails.exception?.description || "")
      );
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 440,
    height: 800,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await send("Page.enable");
  await send("Page.navigate", {
    url: pathToFileURL(resolve("dist/index.html")).href,
  });
  await sleep(4000);

  // menu -> name save -> new game -> play
  for (const [x, y] of [
    [220, 418],
    [220, 449],
    [220, 631],
  ]) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await sleep(60);
    }
    await sleep(1400);
  }

  // instrument the frame counter so we can tell "hung" from "running"
  await send("Runtime.evaluate", {
    expression: "window.__frames = 0; (function tick(){ window.__frames++; requestAnimationFrame(tick); })();",
  });

  // THE SPAM: fast taps in the bin area, alternating x a little
  for (let i = 0; i < tapCount; i++) {
    const x = 180 + (i % 3) * 40;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y: 300, button: "left", clickCount: 1 });
    await sleep(gapMs / 3);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: 300, button: "left", clickCount: 1 });
    await sleep(gapMs);
  }
  await sleep(800);

  const f1 = await send("Runtime.evaluate", { expression: "window.__frames", returnByValue: true });
  await sleep(1000);
  const f2 = await send("Runtime.evaluate", { expression: "window.__frames", returnByValue: true });
  const state = await send("Runtime.evaluate", {
    expression: `(() => { const s = window.game.scene.keys.Game;
      return { foods: s.pile.items.length, score: s.state.score,
               drops: s.state.totalDrops, aiming: s.aiming,
               press: !!s.press, feeding: s.feeding, over: s.over }; })()`,
    returnByValue: true,
  });
  console.log("frames advanced in 1s:", f2.result.value - f1.result.value);
  console.log("game state:", JSON.stringify(state.result?.value));
  // Can the game still take one more normal drop? Tap high in the bin near
  // the wall, where the pile can't have reached — a tap ON food is a feed
  // attempt, not a drop, and reads as a false "stuck".
  const before = state.result?.value?.drops ?? -1;
  await sleep(700); // let any reload window lapse
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x: 95, y: 230, button: "left", clickCount: 1 });
    await sleep(120);
  }
  await sleep(600);
  const after = await send("Runtime.evaluate", {
    expression: "window.game.scene.keys.Game.state.totalDrops",
    returnByValue: true,
  });
  console.log(`one more tap: drops ${before} -> ${after.result?.value} (${after.result?.value > before ? "responsive" : "STUCK"})`);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("wrote", out);
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.slice(0, 5).join("\n"));
  else console.log("no page errors");
} finally {
  ws?.close();
  chrome.kill();
}
