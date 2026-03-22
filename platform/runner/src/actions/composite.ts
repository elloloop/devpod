import { ActionDefinition, StepDefinition, ExpressionContext, Step } from '../types.js';
import { evaluateExpression } from '../engine/expression.js';

/**
 * Resolve action inputs: merge provided `with` values with action input defaults.
 */
export function resolveActionInputs(
  action: ActionDefinition,
  withInputs: Record<string, string> | undefined,
  ctx: ExpressionContext,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  if (action.inputs) {
    for (const [name, def] of Object.entries(action.inputs)) {
      if (withInputs && name in withInputs) {
        resolved[name] = evaluateExpression(withInputs[name], ctx);
      } else if (def.default !== undefined) {
        resolved[name] = evaluateExpression(def.default, ctx);
      } else if (def.required) {
        console.warn(`Missing required input '${name}' for action '${action.name}'`);
        resolved[name] = '';
      }
    }
  }

  // Also include any extra with values not defined in action inputs
  if (withInputs) {
    for (const [k, v] of Object.entries(withInputs)) {
      if (!(k in resolved)) {
        resolved[k] = evaluateExpression(v, ctx);
      }
    }
  }

  return resolved;
}

/**
 * Get the steps for a composite action, injecting the action inputs
 * as INPUT_ environment variables (matching GitHub Actions behavior).
 */
export function getCompositeSteps(
  action: ActionDefinition,
  actionInputs: Record<string, string>,
): { steps: StepDefinition[]; env: Record<string, string> } {
  if (action.runs.using !== 'composite' || !action.runs.steps) {
    throw new Error(`Action '${action.name}' is not a composite action or has no steps`);
  }

  // GitHub Actions provides inputs as INPUT_<NAME> env vars (uppercased)
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(actionInputs)) {
    env[`INPUT_${name.toUpperCase()}`] = value;
  }

  return {
    steps: action.runs.steps,
    env,
  };
}

/**
 * Resolve composite action outputs by evaluating their value expressions
 * against the completed step contexts.
 */
export function resolveCompositeOutputs(
  action: ActionDefinition,
  ctx: ExpressionContext,
): Record<string, string> {
  const outputs: Record<string, string> = {};

  if (action.outputs) {
    for (const [name, def] of Object.entries(action.outputs)) {
      if (def.value) {
        outputs[name] = evaluateExpression(def.value, ctx);
      }
    }
  }

  return outputs;
}
