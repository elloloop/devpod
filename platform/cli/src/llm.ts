import type { ChangeType } from './workspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMResult {
  title: string;        // "feat(auth): add login API endpoints"
  description: string;  // "- Add /api/auth/login endpoint\n- JWT token generation"
}

export interface LLMProvider {
  name: string;
  generate(prompt: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Provider detection (in order)
// 1. DEVPOD_LLM_URL (custom OpenAI-compatible endpoint)
// 2. ANTHROPIC_API_KEY
// 3. OPENAI_API_KEY
// 4. Check Ollama at localhost:11434
// 5. Fallback (no LLM)
// ---------------------------------------------------------------------------

const LLM_TIMEOUT = 5000;

export function detectProvider(): LLMProvider | null {
  // 1. Custom endpoint
  if (process.env.DEVPOD_LLM_URL) {
    return createOpenAIProvider(
      'custom',
      process.env.DEVPOD_LLM_URL,
      process.env.DEVPOD_LLM_KEY || '',
      process.env.DEVPOD_LLM_MODEL || 'default',
    );
  }

  // 2. Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider(
      process.env.ANTHROPIC_API_KEY,
      process.env.DEVPOD_LLM_MODEL || 'claude-sonnet-4-20250514',
    );
  }

  // 3. OpenAI
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIProvider(
      'openai',
      'https://api.openai.com',
      process.env.OPENAI_API_KEY,
      process.env.DEVPOD_LLM_MODEL || 'gpt-4o-mini',
    );
  }

  // 4. Ollama — we cannot do a synchronous check here, so we create
  //    the provider optimistically. If Ollama is down, the call will
  //    fail within the timeout and the caller falls back.
  return createOpenAIProvider(
    'ollama',
    'http://localhost:11434',
    '',
    process.env.DEVPOD_LLM_MODEL || 'llama3.2',
  );
}

export function isLLMAvailable(): boolean {
  return !!(
    process.env.DEVPOD_LLM_URL ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY
  );
  // Ollama availability requires a network check and is best-effort,
  // so we don't include it in this synchronous check.
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

function createAnthropicProvider(apiKey: string, model: string): LLMProvider {
  return {
    name: 'anthropic',
    async generate(prompt: string): Promise<string> {
      const response = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        LLM_TIMEOUT,
      );
      const json = (await response.json()) as { content?: { text?: string }[] };
      return json.content?.[0]?.text || '';
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (also used for Ollama and custom endpoints)
// ---------------------------------------------------------------------------

function createOpenAIProvider(
  name: string,
  baseUrl: string,
  apiKey: string,
  model: string,
): LLMProvider {
  return {
    name,
    async generate(prompt: string): Promise<string> {
      const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You generate concise commit messages.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 300,
            temperature: 0.3,
          }),
        },
        LLM_TIMEOUT,
      );
      const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content || '';
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP helper with timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

function commitMessagePrompt(diff: string, type: ChangeType, scope: string): string {
  return `Generate a conventional commit message for this diff.

Type: ${type}
Scope: ${scope}

Format:
- Title: type(scope): description (max 72 chars, lowercase)
- Description: 2-3 bullet points starting with "- "

Rules:
- Be specific about what was added/changed/removed
- No AI attribution
- No generic messages like "update files"

Diff:
${diff.slice(0, 3000)}`;
}

function typeDetectionPrompt(diff: string): string {
  return `Classify this code change as one of: feature, fix, docs, chore

- feature: new functionality or capability
- fix: bug fix or error correction
- docs: documentation changes only
- chore: tooling, dependencies, config, refactoring

Respond with ONLY the type word, nothing else.

Diff:
${diff.slice(0, 2000)}`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseCommitMessageResponse(text: string, type: ChangeType, scope: string): LLMResult {
  // Try to extract title line (first non-empty line)
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) {
    return { title: `${type}(${scope}): update files`, description: '' };
  }

  // Look for explicit TITLE:/DESCRIPTION: format
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*([\s\S]*)/i);
  if (titleMatch) {
    return {
      title: titleMatch[1]!.trim().slice(0, 72),
      description: descMatch ? descMatch[1]!.trim() : '',
    };
  }

  // Otherwise take first line as title, rest as description
  let title = lines[0]!.trim();
  // Ensure title follows conventional commit format
  if (!title.match(/^\w+\(/)) {
    title = `${type}(${scope}): ${title}`;
  }

  const descLines = lines.slice(1).filter((l) => l.startsWith('- '));
  return {
    title: title.slice(0, 72),
    description: descLines.join('\n'),
  };
}

function parseTypeResponse(text: string): ChangeType {
  const cleaned = text.toLowerCase().trim();
  if (cleaned.includes('fix')) return 'fix';
  if (cleaned.includes('docs') || cleaned.includes('documentation')) return 'docs';
  if (cleaned.includes('chore')) return 'chore';
  if (cleaned.includes('feature') || cleaned.includes('feat')) return 'feature';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

export async function generateDiffMessage(diff: string, type: ChangeType, scope: string): Promise<LLMResult> {
  const provider = detectProvider();
  if (!provider) {
    return { title: `${type}(${scope}): update files`, description: '' };
  }

  try {
    const prompt = commitMessagePrompt(diff, type, scope);
    const text = await provider.generate(prompt);
    if (!text) {
      return { title: `${type}(${scope}): update files`, description: '' };
    }
    return parseCommitMessageResponse(text, type, scope);
  } catch {
    return { title: `${type}(${scope}): update files`, description: '' };
  }
}

export async function detectChangeType(diff: string): Promise<ChangeType> {
  const provider = detectProvider();
  if (!provider) return 'unknown';

  try {
    const prompt = typeDetectionPrompt(diff);
    const text = await provider.generate(prompt);
    if (!text) return 'unknown';
    return parseTypeResponse(text);
  } catch {
    return 'unknown';
  }
}

export function generateFallbackMessage(files: string[], type: ChangeType, scope: string): LLMResult {
  if (files.length === 0) {
    return { title: `${type}(${scope}): update files`, description: '' };
  }

  const areas = new Set<string>();
  for (const f of files) {
    const parts = f.split('/');
    if (parts.length > 1) areas.add(parts[parts.length - 2]!);
    else areas.add(f);
  }
  const areaStr = Array.from(areas).slice(0, 3).join(', ');
  return {
    title: `${type}(${scope}): update ${areaStr}`.slice(0, 72),
    description: files.map((f) => `- ${f}`).slice(0, 5).join('\n'),
  };
}
