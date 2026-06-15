import { Queue } from "bullmq";

export function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const { hostname, port, password } = new URL(url);
    return {
      host: hostname,
      port: Number(port || 6379),
      ...(password ? { password: decodeURIComponent(password) } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? "6379"),
  };
}

const connection = getRedisConnection();

export const RESEARCH_QUEUE_NAME = "research";

export type ResearchJobPayload = {
  firmId: string;
  jobId: string;
};

export const researchQueue = new Queue<ResearchJobPayload>(RESEARCH_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

// ---------------------------------------------------------------------------
// Cross-cutting analysis queue (Phase 4 — ANAL-04)
// ---------------------------------------------------------------------------

export const CROSS_CUTTING_QUEUE_NAME = "cross-cutting-analysis";

export type CrossCuttingJobPayload = {
  firmId: string;
  jobId: string;
};

/**
 * BullMQ queue for cross-cutting analysis jobs.
 *
 * Enqueued automatically after a research job transitions to "done"
 * (src/lib/jobs/runner.ts). Processed by the cross-cutting worker in
 * src/scripts/worker-process.ts.
 *
 * Uses the same connection and default options as the research queue.
 */
export const crossCuttingQueue = new Queue<CrossCuttingJobPayload>(
  CROSS_CUTTING_QUEUE_NAME,
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  },
);
