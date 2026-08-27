// Dev-only probe: prove the next legal command is accepted during cosmetic resolution.
import puppeteer from "puppeteer-core";

const HARNESS_URL = new URL(
  "/src/dev/combat-ux-harness.html",
  process.env.COMBAT_PROBE_BASE_URL || "http://127.0.0.1:5199",
).href;

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--window-size=430,932", "--force-device-scale-factor=2"],
  defaultViewport: {
    width: 430,
    height: 820,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
});

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(HARNESS_URL, {
    waitUntil: "networkidle0",
    timeout: 60_000,
  });
  await page.waitForSelector(".tow-combat", { timeout: 30_000 });
  const standDown = await page.evaluate(() => {
    const button = document.querySelector(".tow-combat__hold");
    if (!button) return { present: false, visible: false, height: 0 };
    const rect = button.getBoundingClientRect();
    return {
      present: true,
      visible: getComputedStyle(button).display !== "none" && rect.width > 0 && rect.height > 0,
      height: Math.round(rect.height),
    };
  });
  const statusIcon = await page.evaluate(() => {
    const icon = document.querySelector(".tow-formation-status");
    if (!icon) return null;
    const rect = icon.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  });
  const initialCommandRect = await page.$eval(".tow-combat__command", (node) => {
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  });

  let confirmationButtons = null;
  async function commitStrike() {
    await page.evaluate(() => {
      const strike = [...document.querySelectorAll(".tow-combat__action")]
        .find((button) => button.dataset.skillId === "strike" && !button.disabled);
      if (!strike) throw new Error("available-strike-not-found");
      strike.click();
    });
    await page.waitForSelector("[data-testid='tow-target-confirmation']", { timeout: 5_000 });
    if (confirmationButtons === null) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      confirmationButtons = await page.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll("[data-testid='tow-target-confirmation'] button")]
          .map((button) => [button.textContent.trim(), Math.round(button.getBoundingClientRect().height)]),
      ));

    }
    await page.evaluate(() => {
      const target = document.querySelector(".tow-formation-cell.is-valid-anchor:not(:disabled)");
      if (!target) throw new Error("valid-target-not-found");
      target.click();
    });
  }

  await commitStrike();
  await page.waitForFunction(
    () => document.querySelector("#harness-log")?.textContent.includes("rev 1"),
    { timeout: 5_000 },
  );
  await page.waitForFunction(
    () => document.querySelector(".tow-combat")?.dataset.presentationPhase === "resolve",
    { timeout: 5_000 },
  );

  const beforeSecond = await page.evaluate(() => ({
    busy: document.querySelector(".tow-combat")?.getAttribute("aria-busy"),
    phase: document.querySelector(".tow-combat")?.dataset.presentationPhase,
    actor: document.querySelector(".tow-formation-unit.is-active .tow-formation-unit__active-label")
      ?.textContent.replace(/\s+/g, " ").trim(),
    commandRect: (() => {
      const rect = document.querySelector(".tow-combat__command")?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : null;
    })(),
  }));
  const secondStarted = performance.now();
  await commitStrike();
  let secondAccepted = true;
  try {
    await page.waitForFunction(
      () => (document.querySelector("#harness-log")?.textContent.match(/OK use-skill strike/g) || []).length >= 2,
      { timeout: 5_000 },
    );
  } catch {
    secondAccepted = false;
  }
  const acceptedMs = Math.round(performance.now() - secondStarted);
  const log = await page.$eval("#harness-log", (node) => node.textContent);
  const afterSecond = await page.evaluate(() => ({
    phase: document.querySelector(".tow-combat")?.dataset.presentationPhase,
    activeActorId: document.querySelector(".tow-formation-unit.is-active")?.dataset.actorId,
    targetConfirmation: Boolean(document.querySelector("[data-testid='tow-target-confirmation']")),
  }));

  const result = {
    acceptedDuringCosmeticResolution: beforeSecond.busy === "true"
      && beforeSecond.phase === "resolve"
      && secondAccepted,
    commandRailStable: Boolean(beforeSecond.commandRect)
      && Math.abs(initialCommandRect.x - beforeSecond.commandRect.x) <= 1
      && Math.abs(initialCommandRect.y - beforeSecond.commandRect.y) <= 1
      && Math.abs(initialCommandRect.width - beforeSecond.commandRect.width) <= 1
      && Math.abs(initialCommandRect.height - beforeSecond.commandRect.height) <= 1,
    acceptedMs,
    standDown,
    statusIcon,
    initialCommandRect,
    confirmationButtons,
    beforeSecond,
    afterSecond,
    log: log.replace(/\s+/g, " ").trim(),
    pageErrors: errors,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.acceptedDuringCosmeticResolution
    || !result.commandRailStable
    || !standDown.visible
    || standDown.height < 44
    || (statusIcon !== null && (statusIcon.width < 16 || statusIcon.height < 16))
    || Object.values(confirmationButtons || {}).some((height) => height < 44)
    || errors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
