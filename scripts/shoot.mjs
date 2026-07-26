/**
 * Screenshot the built game from headless Chrome, optionally tapping first.
 *
 *   node scripts/shoot.mjs <out.png> [taps] [url] [evalJs]
 *
 * `evalJs` runs in the page after the taps (e.g. to jump the game to a later
 * milestone before the shot).
 *
 * `taps` is a semicolon-separated list of "x,y" CSS-pixel points, each clicked
 * with a short settle after it. Chrome's own --screenshot flag can't be used:
 * it waits for the virtual time budget to drain, and a Phaser game's endless
 * requestAnimationFrame loop means that never happens.
 *
 * Reaching the bin from a cold profile is: name-Save, New game, Play —
 *   node scripts/shoot.mjs shot.png "220,418;220,449;220,631"
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const out = process.argv[2];
const taps = (process.argv[3] || "")
  .split(";")
  .filter(Boolean)
  .map((p) => p.split(",").map(Number));
const url = process.argv[4] || pathToFileURL(resolve("dist/index.html")).href;
const evalJs = process.argv[5] || "";

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
  // wait for the debugging endpoint
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {
      /* not up yet */
    }
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
  await send("Log.enable");
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description || ""));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      errors.push(m.params.entry.text);
  });

  await send("Emulation.setDeviceMetricsOverride", {
    width: 440,
    height: 800,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await send("Page.enable");
  await send("Page.navigate", { url });
  await sleep(4000);

  for (const [x, y] of taps) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await sleep(60);
    }
    await sleep(1400);
  }
  if (evalJs) {
    // awaitPromise lets probes be async IIFEs that settle when their work does
    const r = await send("Runtime.evaluate", {
      expression: evalJs,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) console.log("EVAL ERROR:", r.exceptionDetails.text);
    else console.log("eval:", JSON.stringify(r.result?.value));
    await sleep(1200);
  }
  await sleep(600);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("wrote", out);
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
  else console.log("no page errors");
} finally {
  ws?.close();
  chrome.kill();
}
