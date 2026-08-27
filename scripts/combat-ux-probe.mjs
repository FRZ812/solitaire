// Dev-only probe: drives the combat UX harness in headless Chrome/Edge and dumps
// screenshots + a DOM-state timeline. Run: node scripts/combat-ux-probe.mjs
import puppeteer from "puppeteer-core";

const HARNESS_URL = new URL(
  "/src/dev/combat-ux-harness.html",
  process.env.COMBAT_PROBE_BASE_URL || "http://127.0.0.1:5199",
).href;
import { mkdirSync } from "node:fs";

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
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
});
await page.goto(HARNESS_URL, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".archetype-combat", { timeout: 30000 });
await new Promise((resolve) => setTimeout(resolve, 1200));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
const state = () => page.evaluate(() => {
  const combat = document.querySelector(".archetype-combat");
  if (!combat) return { gone: true };
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() || null;
  return {
    phase: combat.getAttribute("data-presentation-phase"),
    busy: combat.getAttribute("aria-busy"),
    round: text(".archetype-combat__round strong"),
    statusLine: text(".archetype-combat__round em"),
    context: text(".archetype-combat__context"),
    actions: [...document.querySelectorAll(".archetype-combat__action")].map((button) => ({
      id: button.getAttribute("data-skill-id"),
      label: button.getAttribute("aria-label")?.slice(0, 110),
      disabled: button.disabled || button.getAttribute("aria-disabled") === "true",
    })),
    targetConfirmation: !!document.querySelector('[data-testid="combat-target-confirmation"]'),
    log: [...document.querySelectorAll("#harness-log div")].map((row) => row.textContent).slice(-6),
  };
});

await shot("01-entry");
console.log("ENTRY", JSON.stringify(await state(), null, 1));

// Tap the Strike ability and watch what happens next.
await page.evaluate(() => {
  const strike = [...document.querySelectorAll(".archetype-combat__action")]
    .find((button) => button.getAttribute("data-skill-id") === "strike");
  strike.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await sleep(350);
await shot("02-after-tap-strike");
console.log("AFTER TAP", JSON.stringify(await state(), null, 1));

// Wait for the beat to finish and the command to land.
await sleep(2500);
await shot("03-after-commit");
console.log("AFTER COMMIT", JSON.stringify(await state(), null, 1));

// Second strike to see repeat-flow pacing.
await page.evaluate(() => {
  const strike = [...document.querySelectorAll(".archetype-combat__action")]
    .find((button) => button.getAttribute("data-skill-id") === "strike" && !button.disabled);
  if (strike) strike.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await sleep(2600);
await shot("04-second-strike");
console.log("SECOND STRIKE", JSON.stringify(await state(), null, 1));

// Open a targeting-heavy ability if present.
const abilityIds = await page.evaluate(() => [...document.querySelectorAll(".archetype-combat__action")]
  .map((button) => button.getAttribute("data-skill-id")));
console.log("ABILITIES", abilityIds.join(","));
for (const skillId of abilityIds.filter((id) => id && id !== "strike")) {
  await page.evaluate((id) => {
    const button = [...document.querySelectorAll(".archetype-combat__action")]
      .find((candidate) => candidate.getAttribute("data-skill-id") === id && !candidate.disabled);
    if (button) button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, skillId);
  await sleep(500);
  await shot(`10-targeting-${skillId}`);
  console.log(`TARGETING ${skillId}`, JSON.stringify(await state(), null, 1));
  // cancel back
  await page.evaluate(() => {
    const cancel = [...document.querySelectorAll(".archetype-combat__target-cancel")][0];
    if (cancel) cancel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await sleep(400);
}

// Inspect an enemy cell (dossier).
await page.evaluate(() => {
  const cell = document.querySelector('[aria-label="Enemy formation"] .combat-formation-cell.has-unit');
  if (cell) cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await sleep(500);
await shot("20-dossier");
const dossierOpen = await page.evaluate(() => Boolean(
  document.querySelector('[data-testid="archetype-combat-dossier"]'),
));
console.log("DOSSIER OPEN", JSON.stringify({ dossier: dossierOpen }));

if (errors.length) console.log("PAGE ERRORS:\n" + errors.slice(0, 12).join("\n"));
await browser.close();
