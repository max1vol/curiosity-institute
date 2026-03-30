import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const userDataDir = process.argv[2];
const outputDir = process.argv[3] ?? "artifacts/captures";

if (!userDataDir) {
  console.error("Usage: node scripts/gemini_ui_probe.mjs <userDataDir> [outputDir]");
  process.exit(1);
}

await fs.mkdir(outputDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  args: ["--disable-gpu"],
  viewport: { width: 1440, height: 1800 },
});

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://gemini.google.com/app", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(4_000);

  const acceptAll = page.getByRole("button", { name: /Accept all/i });
  if (await acceptAll.count()) {
    await acceptAll.first().click({ timeout: 10_000 });
    await page.waitForTimeout(8_000);
  }

  const screenshotPath = path.join(outputDir, "gemini-probe.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const buttonData = await page.locator("button").evaluateAll((nodes) =>
    nodes.slice(0, 120).map((node) => ({
      text: node.innerText?.trim() ?? "",
      aria: node.getAttribute("aria-label") ?? "",
      testId: node.getAttribute("data-test-id") ?? "",
      visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
    })),
  );

  const result = {
    title: await page.title(),
    url: page.url(),
    screenshotPath,
    buttons: buttonData.filter((entry) => entry.visible).slice(0, 40),
    bodyTextSample: (await page.locator("body").innerText()).slice(0, 4000),
  };

  await fs.writeFile(path.join(outputDir, "gemini-probe.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
}
