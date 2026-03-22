/**
 * Expand a matrix strategy definition into individual combinations.
 *
 * Supports:
 * - Simple matrix: { node: [18, 20], os: [linux, mac] } -> 4 combinations
 * - Include: additional specific combinations to add
 * - Exclude: specific combinations to remove from the cartesian product
 */

export interface MatrixStrategy {
  matrix: Record<string, unknown[]> & {
    include?: Record<string, unknown>[];
    exclude?: Record<string, unknown>[];
  };
  'fail-fast'?: boolean;
  'max-parallel'?: number;
}

export interface MatrixCombination {
  [key: string]: string;
}

/**
 * Expand a matrix strategy into an array of concrete combinations.
 *
 * 1. Compute the cartesian product of all array-valued keys (ignoring include/exclude).
 * 2. Remove any combinations that match an exclude entry (all specified properties must match).
 * 3. Process include entries:
 *    - If an include entry matches an existing combination on all shared keys that exist
 *      in the base matrix, merge any additional properties into that combination.
 *    - Otherwise add the include entry as a new combination.
 *
 * All values are stringified so they can be used in expression contexts.
 */
export function expandMatrix(strategy: MatrixStrategy): MatrixCombination[] {
  const { matrix } = strategy;

  // Separate include/exclude from the regular matrix keys
  const include = matrix.include || [];
  const exclude = matrix.exclude || [];

  // Collect the regular matrix keys (everything except include/exclude)
  const keys: string[] = [];
  const valueSets: unknown[][] = [];
  for (const [key, val] of Object.entries(matrix)) {
    if (key === 'include' || key === 'exclude') continue;
    if (!Array.isArray(val)) continue;
    keys.push(key);
    valueSets.push(val);
  }

  // Step 1: Cartesian product
  let combinations: MatrixCombination[] = [];
  if (keys.length === 0) {
    // No base matrix keys — start with an empty combination so includes can still work
    combinations = [{}];
  } else {
    combinations = cartesianProduct(keys, valueSets);
  }

  // Step 2: Apply excludes — remove combinations matching ALL properties in an exclude entry
  if (exclude.length > 0) {
    combinations = combinations.filter(combo => {
      return !exclude.some(ex => matchesCombination(combo, ex));
    });
  }

  // Step 3: Apply includes
  for (const inc of include) {
    const stringifiedInc = stringifyRecord(inc);

    // Check if this include matches an existing combination on the base matrix keys
    let merged = false;
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      // An include merges into an existing combination when all shared base-matrix
      // keys match (i.e. keys that exist both in the include and in the base matrix).
      const sharedBaseKeys = keys.filter(k => k in stringifiedInc);
      if (sharedBaseKeys.length > 0 && sharedBaseKeys.every(k => combo[k] === stringifiedInc[k])) {
        // Merge additional properties from the include into this combination
        combinations[i] = { ...combo, ...stringifiedInc };
        merged = true;
      }
    }

    if (!merged) {
      // Add as a brand new combination
      combinations.push(stringifiedInc);
    }
  }

  // If the only combination is an empty object (no matrix keys and no includes), return empty
  if (combinations.length === 1 && Object.keys(combinations[0]).length === 0) {
    return [];
  }

  return combinations;
}

/**
 * Build the display label for a matrix combination, used for the job ID suffix.
 * Example: { version: "18", platform: "web" } -> "(18, web)"
 */
export function matrixLabel(combo: MatrixCombination): string {
  const values = Object.values(combo);
  if (values.length === 0) return '';
  return `(${values.join(', ')})`;
}

// ── Helpers ──

function cartesianProduct(keys: string[], valueSets: unknown[][]): MatrixCombination[] {
  if (keys.length === 0) return [{}];

  const results: MatrixCombination[] = [];

  function recurse(depth: number, current: MatrixCombination) {
    if (depth === keys.length) {
      results.push({ ...current });
      return;
    }
    for (const val of valueSets[depth]) {
      current[keys[depth]] = String(val);
      recurse(depth + 1, current);
    }
  }

  recurse(0, {});
  return results;
}

function matchesCombination(combo: MatrixCombination, filter: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (combo[key] !== String(val)) return false;
  }
  return true;
}

function stringifyRecord(rec: Record<string, unknown>): MatrixCombination {
  const result: MatrixCombination = {};
  for (const [k, v] of Object.entries(rec)) {
    result[k] = String(v);
  }
  return result;
}
