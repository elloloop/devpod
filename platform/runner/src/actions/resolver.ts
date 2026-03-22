import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';

import { generateShimActionYml } from './shim-framework.js';
import { SHIM_DEFINITIONS } from './shim-definitions.js';

/**
 * Parsed components of a marketplace action reference.
 */
interface MarketplaceRef {
  owner: string;
  repo: string;
  ref: string;
  subpath: string | null;
}

/**
 * Default cache directory for downloaded actions.
 */
function getActionsCacheDir(): string {
  return (
    process.env.RUNNER_ACTIONS_CACHE ||
    path.join(os.homedir(), '.local', 'share', 'local-runner', 'actions-cache')
  );
}

/**
 * Maximum age (in milliseconds) before a cached action is considered stale.
 * Default: 24 hours. Overridable via RUNNER_CACHE_TTL_MS.
 */
function getCacheTtlMs(): number {
  const envVal = process.env.RUNNER_CACHE_TTL_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Whether to skip the cache and always re-download.
 */
function shouldSkipCache(): boolean {
  return process.env.RUNNER_NO_CACHE === '1';
}

/**
 * Parse a marketplace action `uses:` reference into its components.
 *
 * Formats:
 *   owner/repo@ref               → { owner, repo, ref, subpath: null }
 *   owner/repo/subpath@ref       → { owner, repo, ref, subpath }
 *   owner/repo/deep/subpath@ref  → { owner, repo, ref, subpath: "deep/subpath" }
 */
export function parseMarketplaceRef(uses: string): MarketplaceRef | null {
  // Must contain @ for the ref
  const atIdx = uses.lastIndexOf('@');
  if (atIdx === -1) return null;

  const pathPart = uses.slice(0, atIdx);
  const ref = uses.slice(atIdx + 1);

  if (!ref || !pathPart) return null;

  const segments = pathPart.split('/');
  if (segments.length < 2) return null;

  const owner = segments[0];
  const repo = segments[1];
  const subpath = segments.length > 2 ? segments.slice(2).join('/') : null;

  if (!owner || !repo) return null;

  return { owner, repo, ref, subpath };
}

/**
 * Check whether a cached action is fresh enough to use.
 */
function isCacheFresh(cachePath: string): boolean {
  if (shouldSkipCache()) return false;

  try {
    const markerPath = path.join(cachePath, '.runner-cached-at');
    if (!fs.existsSync(markerPath)) return false;

    const cachedAt = parseInt(fs.readFileSync(markerPath, 'utf-8').trim(), 10);
    if (isNaN(cachedAt)) return false;

    return (Date.now() - cachedAt) < getCacheTtlMs();
  } catch {
    return false;
  }
}

/**
 * Write a cache freshness marker.
 */
function writeCacheMarker(cachePath: string): void {
  try {
    fs.writeFileSync(path.join(cachePath, '.runner-cached-at'), String(Date.now()));
  } catch {
    // Non-fatal: worst case we re-download next time
  }
}

/**
 * Download a marketplace action from GitHub via git clone.
 * Caches the result for future use.
 *
 * @returns The local filesystem path to the action root (or subpath within it).
 */
export async function resolveMarketplaceAction(uses: string): Promise<string> {
  const parsed = parseMarketplaceRef(uses);
  if (!parsed) {
    throw new Error(
      `Invalid marketplace action reference: '${uses}'. ` +
      `Expected format: owner/repo@ref or owner/repo/subpath@ref`
    );
  }

  const { owner, repo, ref, subpath } = parsed;
  const cacheBase = getActionsCacheDir();
  const repoCache = path.join(cacheBase, owner, repo, ref);

  // Special-case common actions that need local shims
  const shimHandler = BUILTIN_SHIMS[`${owner}/${repo}`];
  if (shimHandler) {
    const result = shimHandler(repoCache, ref, subpath);
    if (result) return result; // null means fall through to real download
  }

  // Check if we have a fresh cache
  if (isCacheFresh(repoCache)) {
    console.log(`Using cached action ${owner}/${repo}@${ref}`);
    return subpath ? path.join(repoCache, subpath) : repoCache;
  }

  // Download the action
  console.log(`Downloading ${owner}/${repo}@${ref}...`);

  // Ensure cache directory exists
  fs.mkdirSync(path.dirname(repoCache), { recursive: true });

  // Remove stale cache if it exists
  if (fs.existsSync(repoCache)) {
    fs.rmSync(repoCache, { recursive: true, force: true });
  }

  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  // Build the clone URL, injecting token if available for private repos
  let cloneUrl = repoUrl;
  if (token) {
    cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  }

  try {
    // Try cloning with the given ref (works for branches and tags)
    execFileSync('git', [
      'clone',
      '--depth', '1',
      '--branch', ref,
      '--single-branch',
      cloneUrl,
      repoCache,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000, // 2 minutes
    });
  } catch (cloneErr) {
    // The ref might be a full SHA or a ref that git clone --branch doesn't handle.
    // Fall back to a full shallow clone + checkout.
    try {
      if (fs.existsSync(repoCache)) {
        fs.rmSync(repoCache, { recursive: true, force: true });
      }

      execFileSync('git', [
        'clone',
        '--no-checkout',
        '--filter=blob:none',
        cloneUrl,
        repoCache,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      });

      execFileSync('git', ['checkout', ref], {
        cwd: repoCache,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      });
    } catch (fallbackErr) {
      // Clean up partial clone
      if (fs.existsSync(repoCache)) {
        try { fs.rmSync(repoCache, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      const hint = token
        ? 'The repository may not exist or the token may lack access.'
        : 'If this is a private repository, set GITHUB_TOKEN or GH_TOKEN.';

      throw new Error(
        `Failed to download action ${owner}/${repo}@${ref}: ` +
        `${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}. ${hint}`
      );
    }
  }

  // Remove the .git directory to save space
  const dotGit = path.join(repoCache, '.git');
  if (fs.existsSync(dotGit)) {
    try { fs.rmSync(dotGit, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  writeCacheMarker(repoCache);
  console.log(`Cached ${owner}/${repo}@${ref} at ${repoCache}`);

  const actionDir = subpath ? path.join(repoCache, subpath) : repoCache;

  if (!fs.existsSync(actionDir)) {
    throw new Error(
      `Action subpath '${subpath}' not found in ${owner}/${repo}@${ref}. ` +
      `Directory does not exist: ${actionDir}`
    );
  }

  return actionDir;
}

// ── Built-in action shims ──
// These replace common GitHub Actions with local equivalents that work without
// GitHub's internal APIs (artifact service, cache service, etc.)
//
// Language/tool setup shims are declared in shim-definitions.ts and compiled
// via the framework in shim-framework.ts. Non-language shims (checkout,
// artifact, cache) remain here as they have custom logic.

type ShimHandler = (repoCache: string, ref: string, subpath: string | null) => string;

function writeShim(repoCache: string, actionYml: string, subpath: string | null): string {
  fs.mkdirSync(repoCache, { recursive: true });
  fs.writeFileSync(path.join(repoCache, 'action.yml'), actionYml);
  writeCacheMarker(repoCache);
  return subpath ? path.join(repoCache, subpath) : repoCache;
}

/** Generate a ShimHandler from a declarative ShimDefinition key. */
function langShim(key: string): ShimHandler {
  return (repoCache, _ref, subpath) =>
    writeShim(repoCache, generateShimActionYml(SHIM_DEFINITIONS[key]), subpath);
}

const BUILTIN_SHIMS: Record<string, ShimHandler> = {

  'actions/checkout': (repoCache, _ref, subpath) => writeShim(repoCache, `
name: 'Checkout (local shim)'
description: 'Local runner shim for actions/checkout'
inputs:
  repository: { description: 'Repository', default: '' }
  ref: { description: 'Ref to checkout', default: '' }
  fetch-depth: { description: 'Fetch depth', default: '1' }
  token: { description: 'Token', default: '' }
  submodules: { description: 'Submodules', default: 'false' }
  path: { description: 'Path', default: '' }
  clean: { description: 'Clean', default: 'true' }
  lfs: { description: 'LFS', default: 'false' }
  persist-credentials: { description: 'Persist creds', default: 'true' }
runs:
  using: 'composite'
  steps:
    - name: Checkout
      shell: bash
      run: |
        REF="\${{ inputs.ref }}"
        if [ -n "$REF" ]; then
          echo "Checking out ref: $REF"
          git checkout "$REF" 2>/dev/null || git fetch origin "$REF" && git checkout "$REF"
        else
          echo "Workspace already available, no checkout needed"
        fi
`, subpath),

  'actions/upload-artifact': (repoCache, _ref, subpath) => writeShim(repoCache, `
name: 'Upload Artifact (local shim)'
description: 'Local runner shim — copies artifacts to .artifacts/ directory'
inputs:
  name: { description: 'Artifact name', required: true }
  path: { description: 'File or directory path(s) to upload', required: true }
  if-no-files-found: { description: 'Behavior if no files found', default: 'warn' }
  retention-days: { description: 'Retention days', default: '90' }
  compression-level: { description: 'Compression level', default: '6' }
  overwrite: { description: 'Overwrite existing', default: 'false' }
outputs:
  artifact-id:
    description: 'Artifact ID'
    value: 'local-artifact'
  artifact-url:
    description: 'Artifact URL'
    value: ''
runs:
  using: 'composite'
  steps:
    - name: Upload artifact locally
      shell: bash
      run: |
        NAME="\${{ inputs.name }}"
        PATHS="\${{ inputs.path }}"
        DEST="$GITHUB_WORKSPACE/.artifacts/$NAME"
        mkdir -p "$DEST"
        echo "Uploading artifact '$NAME' locally..."
        FOUND=0
        while IFS= read -r pattern; do
          pattern=$(echo "$pattern" | xargs)
          [ -z "$pattern" ] && continue
          for f in $pattern; do
            if [ -e "$f" ]; then
              cp -r "$f" "$DEST/" 2>/dev/null && FOUND=$((FOUND+1))
            fi
          done
        done <<< "$PATHS"
        if [ "$FOUND" -eq 0 ]; then
          NO_FILES="\${{ inputs.if-no-files-found }}"
          if [ "$NO_FILES" = "error" ]; then
            echo "::error::No files found matching: $PATHS"
            exit 1
          elif [ "$NO_FILES" = "warn" ]; then
            echo "::warning::No files found matching: $PATHS"
          fi
        else
          echo "Uploaded $FOUND item(s) to .artifacts/$NAME"
          ls -la "$DEST"
        fi
`, subpath),

  'actions/download-artifact': (repoCache, _ref, subpath) => writeShim(repoCache, `
name: 'Download Artifact (local shim)'
description: 'Local runner shim — copies artifacts from .artifacts/ directory'
inputs:
  name: { description: 'Artifact name', default: '' }
  path: { description: 'Destination path', default: '.' }
  merge-multiple: { description: 'Merge multiple artifacts', default: 'false' }
runs:
  using: 'composite'
  steps:
    - name: Download artifact locally
      shell: bash
      run: |
        NAME="\${{ inputs.name }}"
        DEST="\${{ inputs.path }}"
        mkdir -p "$DEST"
        if [ -n "$NAME" ]; then
          SRC="$GITHUB_WORKSPACE/.artifacts/$NAME"
          if [ -d "$SRC" ]; then
            cp -r "$SRC"/* "$DEST/" 2>/dev/null || true
            echo "Downloaded artifact '$NAME' to $DEST"
          else
            echo "::warning::Artifact '$NAME' not found at $SRC"
          fi
        else
          if [ -d "$GITHUB_WORKSPACE/.artifacts" ]; then
            cp -r "$GITHUB_WORKSPACE/.artifacts"/* "$DEST/" 2>/dev/null || true
            echo "Downloaded all artifacts to $DEST"
          fi
        fi
`, subpath),

  'actions/cache': (repoCache, _ref, subpath) => writeShim(repoCache, `
name: 'Cache (local shim)'
description: 'Local runner shim — uses filesystem cache at ~/.local/share/local-runner/cache/'
inputs:
  path: { description: 'Paths to cache', required: true }
  key: { description: 'Cache key', required: true }
  restore-keys: { description: 'Restore keys', default: '' }
  upload-chunk-size: { description: 'Chunk size', default: '' }
  enableCrossOsArchive: { description: 'Cross-OS archive', default: 'false' }
  fail-on-cache-miss: { description: 'Fail on miss', default: 'false' }
  lookup-only: { description: 'Lookup only', default: 'false' }
  save-always: { description: 'Save always', default: 'false' }
outputs:
  cache-hit:
    description: 'Whether cache was found'
    value: \${{ steps.restore.outputs.cache-hit }}
runs:
  using: 'composite'
  steps:
    - name: Restore cache
      id: restore
      shell: bash
      run: |
        KEY="\${{ inputs.key }}"
        PATHS="\${{ inputs.path }}"
        CACHE_DIR="$HOME/.local/share/local-runner/cache"
        CACHE_PATH="$CACHE_DIR/$KEY"
        mkdir -p "$CACHE_DIR"
        if [ -d "$CACHE_PATH" ]; then
          echo "Cache hit for key: $KEY"
          while IFS= read -r target; do
            target=$(echo "$target" | xargs)
            [ -z "$target" ] && continue
            PARENT=$(dirname "$target")
            mkdir -p "$PARENT"
            SAFE_KEY=$(echo "$target" | sed 's|/|__|g')
            if [ -e "$CACHE_PATH/$SAFE_KEY" ]; then
              cp -r "$CACHE_PATH/$SAFE_KEY" "$target"
              echo "  Restored: $target"
            fi
          done <<< "$PATHS"
          echo "cache-hit=true" >> $GITHUB_OUTPUT
        else
          echo "Cache miss for key: $KEY"
          # Try restore-keys prefix matching
          RESTORE="\${{ inputs.restore-keys }}"
          MATCHED=""
          if [ -n "$RESTORE" ]; then
            while IFS= read -r prefix; do
              prefix=$(echo "$prefix" | xargs)
              [ -z "$prefix" ] && continue
              for d in "$CACHE_DIR"/*; do
                BASE=$(basename "$d")
                case "$BASE" in "$prefix"*) MATCHED="$d"; break 2;; esac
              done
            done <<< "$RESTORE"
          fi
          if [ -n "$MATCHED" ]; then
            echo "Partial cache hit via restore-key: $(basename "$MATCHED")"
            while IFS= read -r target; do
              target=$(echo "$target" | xargs)
              [ -z "$target" ] && continue
              PARENT=$(dirname "$target")
              mkdir -p "$PARENT"
              SAFE_KEY=$(echo "$target" | sed 's|/|__|g')
              if [ -e "$MATCHED/$SAFE_KEY" ]; then
                cp -r "$MATCHED/$SAFE_KEY" "$target"
              fi
            done <<< "$PATHS"
          fi
          echo "cache-hit=false" >> $GITHUB_OUTPUT
        fi
    - name: Register cache save (post-job)
      shell: bash
      run: |
        KEY="\${{ inputs.key }}"
        PATHS="\${{ inputs.path }}"
        CACHE_DIR="$HOME/.local/share/local-runner/cache"
        CACHE_PATH="$CACHE_DIR/$KEY"
        mkdir -p "$CACHE_PATH"
        while IFS= read -r target; do
          target=$(echo "$target" | xargs)
          [ -z "$target" ] && continue
          if [ -e "$target" ]; then
            SAFE_KEY=$(echo "$target" | sed 's|/|__|g')
            cp -r "$target" "$CACHE_PATH/$SAFE_KEY"
            echo "Cached: $target"
          fi
        done <<< "$PATHS"
`, subpath),

  // ── Language/tool setup shims (declarative) ──
  // Defined in shim-definitions.ts, compiled via shim-framework.ts

  'actions/setup-python': langShim('actions/setup-python'),
  'actions/setup-java': langShim('actions/setup-java'),
  'actions/setup-ruby': langShim('actions/setup-ruby'),
  'ruby/setup-ruby': (repoCache, ref, subpath) =>
    BUILTIN_SHIMS['actions/setup-ruby'](repoCache, ref, subpath),
  'actions/setup-go': langShim('actions/setup-go'),
  'actions/setup-dotnet': langShim('actions/setup-dotnet'),
  'actions/setup-gradle': langShim('actions/setup-gradle'),
  'gradle/actions': (repoCache, _ref, subpath) => {
    // Handle gradle/actions with subpath routing (e.g., gradle/actions/setup-gradle@v3)
    if (subpath === 'setup-gradle' || subpath === null) {
      return BUILTIN_SHIMS['actions/setup-gradle'](repoCache, _ref, subpath === 'setup-gradle' ? null : subpath);
    }
    // Unknown subpath — write a minimal no-op shim
    return writeShim(repoCache, `
name: 'Gradle Actions (local shim)'
description: 'Local runner shim — unrecognized gradle/actions subpath'
runs:
  using: 'composite'
  steps:
    - name: No-op
      shell: bash
      run: echo "gradle/actions subpath '\${subpath}' not shimmed; skipping."
`, subpath);
  },
  'actions/setup-xcode': langShim('actions/setup-xcode'),
  'maxim-lobanov/setup-xcode': (repoCache, ref, subpath) =>
    BUILTIN_SHIMS['actions/setup-xcode'](repoCache, ref, subpath),
  'subosito/flutter-action': langShim('subosito/flutter-action'),
};

/**
 * Resolve a `uses:` reference to a local directory path.
 *
 * Supports:
 *   - Local: `./path/to/action` → resolves relative to workspace
 *   - Marketplace: `actions/checkout@v4` → downloads from GitHub, caches locally
 *   - Marketplace with subpath: `actions/aws/s3@v1` → subdir within repo
 *   - Docker: `docker://image:tag` → returns the docker reference as-is
 */
export async function resolveActionPath(
  uses: string,
  workspacePath: string,
): Promise<string | null> {
  // Local actions
  if (uses.startsWith('./') || uses.startsWith('../')) {
    return path.resolve(workspacePath, uses);
  }

  // Docker direct reference — handled by docker-runner
  if (uses.startsWith('docker://')) {
    return uses;
  }

  // Marketplace action: download and cache
  return await resolveMarketplaceAction(uses);
}
