/**
 * Long-running BullMQ worker process.
 *
 * Pulls research jobs from the Redis queue and executes them.
 * Runs concurrently (up to WORKER_CONCURRENCY jobs at once, default 2).
 *
 * Usage:
 *   npm run worker
 *   # or directly:
 *   tsx --env-file .env.local src/scripts/worker-process.ts
 */

import { Worker } from "bullmq";

import { executeResearchJob } from "@/lib/jobs/runner";
import { executeCrossCuttingJob } from "@/lib/cross-cutting/runner";
import {
  RESEARCH_QUEUE_NAME,
  type ResearchJobPayload,
  getRedisConnection,
  CROSS_CUTTING_QUEUE_NAME,
  type CrossCuttingJobPayload,
} from "@/lib/jobs/bull";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? "2");
const connection = getRedisConnection();

const worker = new Worker<ResearchJobPayload>(
  RESEARCH_QUEUE_NAME,
  async (job) => {
    const { firmId, jobId } = job.data;
    console.log(`[worker] Starting job ${jobId} for firm ${firmId}`);
    await executeResearchJob(firmId, jobId);
  },
  {
    connection,
    concurrency: CONCURRENCY,
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} (db: ${job.data.jobId}) completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} (db: ${job?.data?.jobId}) failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err.message);
});

// ---------------------------------------------------------------------------
// Cross-cutting analysis worker (Phase 4 — ANAL-04)
// ---------------------------------------------------------------------------

const crossCuttingWorker = new Worker<CrossCuttingJobPayload>(
  CROSS_CUTTING_QUEUE_NAME,
  async (job) => {
    const { firmId, jobId } = job.data;
    console.log(
      `[worker] Starting cross-cutting job ${jobId} for firm ${firmId}`,
    );
    await executeCrossCuttingJob(firmId, jobId);
  },
  {
    connection,
    concurrency: CONCURRENCY,
  },
);

crossCuttingWorker.on("completed", (job) => {
  console.log(
    `[worker] Cross-cutting job ${job.id} (db: ${job.data.jobId}) completed`,
  );
});

crossCuttingWorker.on("failed", (job, err) => {
  console.error(
    `[worker] Cross-cutting job ${job?.id} (db: ${job?.data?.jobId}) failed:`,
    err.message,
  );
});

crossCuttingWorker.on("error", (err) => {
  console.error("[worker] Cross-cutting worker error:", err.message);
});

console.log(
  `[worker] Listening on ${connection.host}:${connection.port} queue="${RESEARCH_QUEUE_NAME}" concurrency=${CONCURRENCY}`,
);
console.log(
  `[worker] Listening on ${connection.host}:${connection.port} queue="${CROSS_CUTTING_QUEUE_NAME}" concurrency=${CONCURRENCY}`,
);

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await worker.close();
  await crossCuttingWorker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
