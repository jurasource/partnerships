import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? "6379"),
};

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
