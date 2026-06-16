/**
 * Diagnostic script — intercepts every Anthropic API request and response,
 * writing them to ./dry-run-output/request-NNN.json and response-NNN.txt.
 *
 * Usage:
 *   tsx --env-file .env.local src/scripts/dry-run-worker.ts <firmId>
 *   # or via npm script:
 *   npm run worker:dry-run -- <firmId>
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { runResearchWorker } from "@/lib/research/worker";
import { tavilyClient } from "@/lib/search/tavily";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const firmId = process.argv[2];

if (!firmId) {
  console.error(
    "Usage: dry-run-worker.ts <firmId>\n" +
      "  firmId  — UUID of the firm row to research (copy from the DB or app logs)",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch interceptor — captures every Anthropic API request and response
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(process.cwd(), "dry-run-output");
let requestIndex = 0;

async function ensureOutputDir() {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return chunks.join("");
}

const originalFetch = globalThis.fetch;

globalThis.fetch = async function dryRunFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

  if (!url.includes("api.anthropic.com")) {
    return originalFetch(input, init);
  }

  const idx = String(++requestIndex).padStart(3, "0");
  await ensureOutputDir();

  // Write request
  try {
    const parsed = init?.body ? JSON.parse(init.body as string) : null;
    await writeFile(path.join(OUTPUT_DIR, `request-${idx}.json`), JSON.stringify(parsed, null, 2), "utf-8");
    console.log(`[dry-run] → request-${idx}.json`);
  } catch (e) {
    console.error(`[dry-run] Failed to write request #${idx}:`, e);
  }

  // Make the real call
  const response = await originalFetch(input, init);

  // Tee the response stream so we can read it for logging while the AI SDK
  // also reads it. Without tee() the SDK would get an already-consumed stream.
  if (response.body) {
    const [streamForConsumer, streamForLogger] = response.body.tee();

    drainStream(streamForLogger)
      .then((raw) => writeFile(path.join(OUTPUT_DIR, `response-${idx}.txt`), raw, "utf-8"))
      .then(() => console.log(`[dry-run] ← response-${idx}.txt`))
      .catch((e) => console.error(`[dry-run] Failed to write response #${idx}:`, e));

    return new Response(streamForConsumer, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
};

// ---------------------------------------------------------------------------
// Run worker
// ---------------------------------------------------------------------------

const FAKE_JOB_ID = `dry-run-${Date.now()}`;

console.log(`[dry-run] Starting research for firm ${firmId} (job: ${FAKE_JOB_ID})`);
console.log(`[dry-run] Request JSON files will be written to: ${OUTPUT_DIR}`);
console.log(`[dry-run] Real Anthropic API calls are made — Ctrl-C to abort early\n`);

runResearchWorker(firmId, FAKE_JOB_ID, tavilyClient)
  .then(() => {
    console.log(`\n[dry-run] Done. Inspect JSON files in ${OUTPUT_DIR}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[dry-run] Worker error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
