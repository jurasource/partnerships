
/**
 * Server-side rate-limited fetch wrapper (Pitfall 6, T-01-11).
 *
 * - timeout per attempt (AbortController)
 * - retry on 429 / 5xx with exponential backoff + jitter, capped by maxRetries
 * - global concurrency cap so a fan-out across firms/endpoints can't burst past
 *   Companies House's ~600 req / 5 min limit
 *
 * NEVER import this into a client component — it is server-only and the CH client
 * built on top carries the secret API key.
 */

export type RateLimitedFetchOptions = {
  /** Per-attempt timeout in ms (default 20s). */
  timeoutMs?: number;
  /** Max retry attempts after the first try (default 4). */
  maxRetries?: number;
  /** Base backoff in ms; doubled each retry (default 500ms). */
  baseDelayMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 500;
const MAX_CONCURRENCY = 4;

// --- tiny concurrency gate ------------------------------------------------
let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, base: number): number {
  const expo = base * 2 ** attempt;
  // full jitter
  return Math.round(Math.random() * expo);
}

/**
 * Fetch with timeout, retry-on-429/5xx (exponential backoff + jitter, capped),
 * and a process-wide concurrency cap. Returns the final Response (which may be a
 * non-OK response if retries are exhausted — callers decide how to handle status).
 */
export async function rateLimitedFetch(
  url: string,
  init: RequestInit = {},
  options: RateLimitedFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  await acquire();
  try {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timer);

        // Retry on rate limit / transient server errors.
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          // Honour Retry-After when present, else exponential backoff + jitter.
          const retryAfter = res.headers.get("retry-after");
          const delay = retryAfter
            ? Number(retryAfter) * 1000
            : backoffDelay(attempt, baseDelayMs);
          await sleep(Number.isFinite(delay) ? delay : backoffDelay(attempt, baseDelayMs));
          continue;
        }

        return res;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (attempt < maxRetries) {
          await sleep(backoffDelay(attempt, baseDelayMs));
          continue;
        }
        throw lastError;
      }
    }

    // Unreachable in practice — loop either returns or throws.
    throw lastError ?? new Error("rateLimitedFetch: exhausted retries");
  } finally {
    release();
  }
}
