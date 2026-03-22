import type { Page } from "playwright";
import * as path from "node:path";
import type { Scenario, ScenarioStep } from "../types.js";

export interface RunnerContext {
  page: Page;
  outputDir: string;
  screenshotPaths: string[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeScreenshotIfNeeded(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (step.screenshot) {
    const name = step.screenshot.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(ctx.outputDir, `${name}.png`);
    await ctx.page.screenshot({ path: filePath, fullPage: false });
    ctx.screenshotPaths.push(filePath);
    console.log(`  screenshot: ${filePath}`);
  }
}

async function waitAfterStep(step: ScenarioStep): Promise<void> {
  if (step.wait && step.wait > 0) {
    await sleep(step.wait);
  }
}

// ── Individual action handlers ─────────────────────────────────────────

async function handleNavigate(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.url) throw new Error("navigate step requires a url");
  await ctx.page.goto(step.url, { waitUntil: "networkidle" });
}

async function handleClick(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector) throw new Error("click step requires a selector");
  await ctx.page.click(step.selector);
}

async function handleType(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector) throw new Error("type step requires a selector");
  if (step.text === undefined) throw new Error("type step requires text");
  await ctx.page.fill(step.selector, step.text);
}

async function handleScroll(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  const amount = step.amount ?? 300;
  const dir = step.direction ?? "down";
  const deltaX =
    dir === "left" ? -amount : dir === "right" ? amount : 0;
  const deltaY =
    dir === "up" ? -amount : dir === "down" ? amount : 0;
  await ctx.page.mouse.wheel(deltaX, deltaY);
}

async function handleHover(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector) throw new Error("hover step requires a selector");
  await ctx.page.hover(step.selector);
}

async function handleSelect(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector) throw new Error("select step requires a selector");
  if (step.value === undefined) throw new Error("select step requires value");
  await ctx.page.selectOption(step.selector, step.value);
}

async function handleScreenshot(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  const name = (step.screenshot ?? step.text ?? "screenshot").replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const filePath = path.join(ctx.outputDir, `${name}.png`);
  await ctx.page.screenshot({ path: filePath, fullPage: false });
  ctx.screenshotPaths.push(filePath);
  console.log(`  screenshot: ${filePath}`);
}

async function handlePause(step: ScenarioStep): Promise<void> {
  const ms = step.duration ?? step.wait ?? 1000;
  await sleep(ms);
}

async function handleWaitFor(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector) throw new Error("wait-for step requires a selector");
  const timeout = step.timeout ?? 30_000;
  await ctx.page.waitForSelector(step.selector, {
    state: "visible",
    timeout,
  });
}

async function handleExecute(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.code) throw new Error("execute step requires code");
  await ctx.page.evaluate(step.code);
}

async function handleAssertVisible(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector)
    throw new Error("assert-visible step requires a selector");
  const el = ctx.page.locator(step.selector);
  const visible = await el.isVisible();
  if (!visible) {
    throw new Error(
      `assert-visible failed: "${step.selector}" is not visible`,
    );
  }
}

async function handleAssertText(
  step: ScenarioStep,
  ctx: RunnerContext,
): Promise<void> {
  if (!step.selector) throw new Error("assert-text step requires a selector");
  if (step.text === undefined) throw new Error("assert-text step requires text");
  const el = ctx.page.locator(step.selector);
  const content = await el.textContent();
  if (!content || !content.includes(step.text)) {
    throw new Error(
      `assert-text failed: "${step.selector}" does not contain "${step.text}" ` +
        `(actual: "${content ?? ""}")`,
    );
  }
}

// ── Dispatch table ─────────────────────────────────────────────────────

type StepHandler = (
  step: ScenarioStep,
  ctx: RunnerContext,
) => Promise<void>;

const handlers: Record<string, StepHandler> = {
  navigate: handleNavigate,
  click: handleClick,
  type: handleType,
  scroll: handleScroll,
  hover: handleHover,
  select: handleSelect,
  screenshot: handleScreenshot,
  pause: (step, _ctx) => handlePause(step),
  "wait-for": handleWaitFor,
  execute: handleExecute,
  "assert-visible": handleAssertVisible,
  "assert-text": handleAssertText,
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Execute every step in a scenario against the provided Playwright page.
 * Returns the list of screenshot paths captured during execution.
 */
export async function runScenario(
  scenario: Scenario,
  ctx: RunnerContext,
): Promise<string[]> {
  console.log(`Running scenario: ${scenario.name}`);
  if (scenario.description) {
    console.log(`  ${scenario.description}`);
  }

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    console.log(`  step ${i + 1}/${scenario.steps.length}: ${step.action}`);

    const handler = handlers[step.action];
    if (!handler) {
      throw new Error(`No handler for action "${step.action}"`);
    }
    await handler(step, ctx);

    // If the step has a `screenshot` field AND the action is not literally
    // "screenshot" (which handles its own capture), take a screenshot now.
    if (step.action !== "screenshot") {
      await takeScreenshotIfNeeded(step, ctx);
    }

    await waitAfterStep(step);
  }

  return ctx.screenshotPaths;
}
