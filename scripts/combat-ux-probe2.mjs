// Dev-only probe 2: plays a full fight in the harness, timing every step of the loop.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const HARNESS_URL = new URL(
  "/src/dev/combat-ux-harness.html",
  process.env.COMBAT_PROBE_BASE_URL || "http://127.0.0.1:5199",
).href;

const OUT = "tmp/combat-ux-probe";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--window-size=430,932", "--force-device-scale-factor=2"],
  defaultViewport: { width: 430, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(HARNESS_URL, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".tow-combat", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1000));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const now = () => Date.now();

async function waitIdle(timeout = 15000) {
  const start = now();
  await page.waitForFunction(() => {
    const combat = document.querySelector(".tow-combat");
    return !combat || combat.getAttribute("aria-busy") !== "true";
  }, { timeout });
  return now() - start;
}

async function tapStrikeAtEnemy() {
  const t0 = now();
  await page.evaluate(() => {
    const strike = [...document.querySelectorAll(".tow-combat__action")]
      .find((b) => b.getAttribute("data-skill-id") === "strike" && !b.disabled);
    if (strike) strike.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  // wait for either confirm bar (needs cell) or immediate commit
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="tow-target-confirmation"]')
    || document.querySelector(".tow-combat")?.getAttribute("aria-busy") === "true"
  ), { timeout: 5000 });
  const hasConfirm = await page.evaluate(() => !!document.querySelector('[data-testid="tow-target-confirmation"]'));
  if (hasConfirm) {
    await page.evaluate(() => {
      const cell = document.querySelector('[aria-label="Enemy formation"] .tow-formation-cell.has-unit:not(:disabled)');
      if (cell) cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }
  const lockedMs = await waitIdle();
  return { t0, hasConfirm, lockedMs };
}

let step = 0;
const timeline = [];
for (let turn = 0; turn < 14; turn += 1) {
  const over = await page.evaluate(() => ({
    outcome: !!document.querySelector(".tow-combat__outcome"),
    combat: !!document.querySelector(".tow-combat"),
  }));
  if (over.outcome || !over.combat) break;

  // who is the active commander? read the glowing unit + status line
  const active = await page.evaluate(() => ({
    status: document.querySelector(".tow-combat__round em")?.textContent,
    activeUnit: document.querySelector(".tow-formation-unit.is-active")?.getAttribute("aria-label") || null,
  }));
  const result = await tapStrikeAtEnemy();
  step += 1;
  await shot(`30-turn-${String(step).padStart(2, "0")}`);
  timeline.push({ step, active: active.status, unit: active.activeUnit, confirmBar: result.hasConfirm, lockMs: result.lockedMs });
  await sleep(250);
}

await shot("40-terminal");
const outcome = await page.evaluate(() => ({
  heading: document.querySelector(".tow-combat__outcome-heading")?.textContent,
  tally: document.querySelector(".tow-combat__tally")?.textContent,
  buttons: [...document.querySelectorAll(".tow-combat__settle")].map((b) => b.textContent),
}));
console.log("TIMELINE", JSON.stringify(timeline, null, 1));
console.log("OUTCOME", JSON.stringify(outcome, null, 1));

const settleStart = now();
await page.evaluate(() => {
  const settle = document.querySelector(".tow-combat__settle");
  if (settle) settle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await sleep(800);
await shot("41-after-settle");
console.log("SETTLE ms", now() - settleStart, "screen:", await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n+/g, " | ")));
if (errors.length) console.log("PAGE ERRORS:\n" + errors.slice(0, 10).join("\n"));
await browser.close();
