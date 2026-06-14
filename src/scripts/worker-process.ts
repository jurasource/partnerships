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
import { RESEARCH_QUEUE_NAME, type ResearchJobPayload } from "@/lib/jobs/bull";

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? "6379");
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? "2");

const worker = new Worker<ResearchJobPayload>(
  RESEARCH_QUEUE_NAME,
  async (job) => {
    const { firmId, jobId } = job.data;
    console.log(`[worker] Starting job ${jobId} for firm ${firmId}`);
    await executeResearchJob(firmId, jobId);
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
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

console.log(
  `[worker] Listening on ${REDIS_HOST}:${REDIS_PORT} queue="${RESEARCH_QUEUE_NAME}" concurrency=${CONCURRENCY}`,
);

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
