import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";
import type { Scenario, ScenarioStep, StepAction } from "../types.js";

const VALID_ACTIONS: Set<string> = new Set<string>([
  "navigate",
  "click",
  "type",
  "scroll",
  "hover",
  "select",
  "screenshot",
  "pause",
  "wait-for",
  "execute",
  "assert-visible",
  "assert-text",
]);

/**
 * Replace `{{key}}` placeholders in a string with values from the supplied
 * variables map.  Unknown keys are left untouched.
 */
export function interpolate(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    return trimmed in variables ? variables[trimmed] : `{{${trimmed}}}`;
  });
}

/**
 * Recursively walk an object / array / string and interpolate every string
 * value found.
 */
function interpolateDeep<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === "string") {
    return interpolate(value, vars) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => interpolateDeep(v, vars)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateDeep(v, vars);
    }
    return out as T;
  }
  return value;
}

function validateStep(step: unknown, index: number): ScenarioStep {
  if (typeof step !== "object" || step === null) {
    throw new Error(`Step ${index} is not an object`);
  }
  const obj = step as Record<string, unknown>;
  if (!obj.action || typeof obj.action !== "string") {
    throw new Error(`Step ${index} is missing a valid "action" field`);
  }
  if (!VALID_ACTIONS.has(obj.action)) {
    throw new Error(
      `Step ${index} has unknown action "${obj.action}". ` +
        `Valid actions: ${[...VALID_ACTIONS].join(", ")}`,
    );
  }
  return { ...obj, action: obj.action as StepAction } as ScenarioStep;
}

/**
 * Parse a scenario YAML file and return a strongly-typed Scenario.
 *
 * @param filePath  Absolute or relative path to the YAML file.
 * @param variables Key-value map used for `{{var}}` interpolation.
 */
export function parseScenario(
  filePath: string,
  variables: Record<string, string> = {},
): Scenario {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Scenario file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  const doc = YAML.parse(raw) as Record<string, unknown>;

  if (!doc || typeof doc !== "object") {
    throw new Error(`Scenario file is empty or not a valid YAML object`);
  }
  if (typeof doc.name !== "string" || doc.name.trim() === "") {
    throw new Error(`Scenario file must include a non-empty "name" field`);
  }
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) {
    throw new Error(`Scenario file must include at least one step`);
  }

  const steps = (doc.steps as unknown[]).map((s, i) => validateStep(s, i));

  const scenario: Scenario = {
    name: doc.name as string,
    description: typeof doc.description === "string" ? doc.description : undefined,
    steps,
  };

  return interpolateDeep(scenario, variables);
}
