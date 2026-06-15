/**
 * Unit tests for cross-cutting job enqueue behaviour (ANAL-04).
 *
 * Verifies that after a successful research job, a cross-cutting-analysis
 * job is enqueued in both the jobs table AND the BullMQ queue; and that
 * after a research failure, NO cross-cutting job is enqueued.
 *
 * All external dependencies (DB, BullMQ, research worker, Tavily) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIRM_ID = "firm-test-enqueue";
const JOB_ID = "job-research-001";
const CC_JOB_ID = "job-cc-001";

const MOCK_RESEARCH_JOB = {
  id: JOB_ID,
  firmId: FIRM_ID,
  topicId: null,
  status: "pending" as const,
  jobType: "research" as const,
  createdAt: "2026-01-01",
  startedAt: null,
  completedAt: null,
  errorMessage: null,
  progressMessage: null,
};

// ---------------------------------------------------------------------------
// Hoisted mocks (required for vi.hoisted() pattern)
// ---------------------------------------------------------------------------

const { mockCrossCuttingQueueAdd } = vi.hoisted(() => ({
  mockCrossCuttingQueueAdd: vi.fn(),
}));

const { mockEnqueueJob } = vi.hoisted(() => ({
  mockEnqueueJob: vi.fn(),
}));

const { mockGetJob } = vi.hoisted(() => ({
  mockGetJob: vi.fn(),
}));

const { mockUpdateJobStatus } = vi.hoisted(() => ({
  mockUpdateJobStatus: vi.fn(),
}));

const { mockUpdateJobProgress } = vi.hoisted(() => ({
  mockUpdateJobProgress: vi.fn(),
}));

const { mockRunResearchWorker } = vi.hoisted(() => ({
  mockRunResearchWorker: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock BullMQ queue
// ---------------------------------------------------------------------------

vi.mock("@/lib/jobs/bull", () => ({
  crossCuttingQueue: {
    add: mockCrossCuttingQueueAdd,
  },
  RESEARCH_QUEUE_NAME: "research",
  CROSS_CUTTING_QUEUE_NAME: "cross-cutting-analysis",
}));

// ---------------------------------------------------------------------------
// Mock queue helpers
// ---------------------------------------------------------------------------

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: mockEnqueueJob,
  getJob: mockGetJob,
  updateJobStatus: mockUpdateJobStatus,
  updateJobProgress: mockUpdateJobProgress,
}));

// ---------------------------------------------------------------------------
// Mock research worker
// ---------------------------------------------------------------------------

vi.mock("@/lib/research/worker", () => ({
  runResearchWorker: mockRunResearchWorker,
}));

// ---------------------------------------------------------------------------
// Mock DB (for lastResearchedAt update)
// ---------------------------------------------------------------------------

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  firms: {
    id: "firms.id",
    lastResearchedAt: "firms.last_researched_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => "eq-stub"),
}));

// ---------------------------------------------------------------------------
// Mock Tavily search client
// ---------------------------------------------------------------------------

vi.mock("@/lib/search/tavily", () => ({
  tavilyClient: {
    search: vi.fn(() => Promise.resolve([])),
  },
}));

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: job found, research succeeds
  mockGetJob.mockResolvedValue(MOCK_RESEARCH_JOB);
  mockUpdateJobStatus.mockResolvedValue(undefined);
  mockUpdateJobProgress.mockResolvedValue(undefined);
  mockRunResearchWorker.mockResolvedValue(undefined);
  mockEnqueueJob.mockResolvedValue(CC_JOB_ID);
  mockCrossCuttingQueueAdd.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executeResearchJob — cross-cutting enqueue on success", () => {
  it("enqueues a cross-cutting job after successful research", async () => {
    const { executeResearchJob } = await import("../runner");
    await executeResearchJob(FIRM_ID, JOB_ID);

    // enqueueJob must have been called with jobType: "cross-cutting-analysis"
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        firmId: FIRM_ID,
        jobType: "cross-cutting-analysis",
      }),
    );

    // crossCuttingQueue.add must have been called exactly once
    expect(mockCrossCuttingQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockCrossCuttingQueueAdd).toHaveBeenCalledWith(
      "cross-cutting",
      expect.objectContaining({ firmId: FIRM_ID, jobId: CC_JOB_ID }),
    );
  });

  it("transitions the research job to 'done' before enqueueing cross-cutting", async () => {
    const callOrder: string[] = [];

    mockUpdateJobStatus.mockImplementation(
      async (_id: string, status: string) => {
        callOrder.push(`updateJobStatus:${status}`);
      },
    );
    mockEnqueueJob.mockImplementation(async () => {
      callOrder.push("enqueueJob");
      return CC_JOB_ID;
    });

    const { executeResearchJob } = await import("../runner");
    await executeResearchJob(FIRM_ID, JOB_ID);

    const doneIdx = callOrder.indexOf("updateJobStatus:done");
    const enqueueIdx = callOrder.indexOf("enqueueJob");
    expect(doneIdx).toBeGreaterThanOrEqual(0);
    expect(enqueueIdx).toBeGreaterThan(doneIdx);
  });
});

describe("executeResearchJob — cross-cutting NOT enqueued on failure", () => {
  it("does NOT enqueue a cross-cutting job when the research worker throws", async () => {
    mockRunResearchWorker.mockRejectedValue(new Error("Network error"));

    const { executeResearchJob } = await import("../runner");
    await executeResearchJob(FIRM_ID, JOB_ID);

    // Research job should have transitioned to failed
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      JOB_ID,
      "failed",
      expect.objectContaining({ errorMessage: "Network error" }),
    );

    // crossCuttingQueue.add must NOT have been called
    expect(mockCrossCuttingQueueAdd).not.toHaveBeenCalled();

    // enqueueJob must NOT have been called for cross-cutting
    const crossCuttingCalls = mockEnqueueJob.mock.calls.filter(
      (call) =>
        call[0] &&
        typeof call[0] === "object" &&
        (call[0] as { jobType?: string }).jobType === "cross-cutting-analysis",
    );
    expect(crossCuttingCalls.length).toBe(0);
  });
});
