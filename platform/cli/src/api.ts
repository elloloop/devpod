import http from 'node:http';

const RUNNER_URL = process.env.DEVPOD_RUNNER_URL || 'http://localhost:4800';

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
  ) {
    super(`API error ${status} ${statusText}: ${body}`);
    this.name = 'ApiError';
  }
}

class ConnectionError extends Error {
  constructor(public url: string, cause?: Error) {
    super(
      `Cannot connect to runner at ${url}. Is it running? Try: devpod start`,
    );
    this.name = 'ConnectionError';
    if (cause) this.cause = cause;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${RUNNER_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ConnectionError(RUNNER_URL, err as Error);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, response.statusText, text);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export async function get<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export async function del(path: string): Promise<void> {
  await request<void>('DELETE', path);
}

export interface SSEEvent {
  type: string;
  data: unknown;
}

export function sseStream(
  path: string,
  onEvent: (type: string, data: unknown) => void,
): () => void {
  const url = new URL(path, RUNNER_URL);
  let aborted = false;

  const req = http.get(
    url.toString(),
    { headers: { Accept: 'text/event-stream' } },
    (res) => {
      let buffer = '';
      let currentEvent = 'message';

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = raw;
            }
            if (!aborted) {
              onEvent(currentEvent, parsed);
            }
            currentEvent = 'message';
          }
          // Empty line marks end of event block; we handle inline above
        }
      });

      res.on('error', () => {
        // Stream ended or errored — silent close
      });
    },
  );

  req.on('error', () => {
    // Connection failed — silent
  });

  return () => {
    aborted = true;
    req.destroy();
  };
}

export async function ping(): Promise<boolean> {
  try {
    await get('/api/health');
    return true;
  } catch {
    return false;
  }
}

export function getRunnerUrl(): string {
  return RUNNER_URL;
}

export { ApiError, ConnectionError };
