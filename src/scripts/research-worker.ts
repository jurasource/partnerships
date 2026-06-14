/**
 * Standalone research worker — spawned as a detached child process by
 * research-actions.ts so the Next.js server event loop stays free while
 * Tavily + Claude API calls run sequentially for each topic.
 *
 * Usage: tsx src/scripts/research-worker.ts <firmId> <jobId>
 *
 * Run with --conditions react-server so that `import "server-only"` resolves
 * to the empty shim instead of throwing (handled by the spawner via NODE_OPTIONS).
 */

import { executeResearchJob } from "@/lib/jobs/runner";

const [firmId, jobId] = process.argv.slice(2);

if (!firmId || !jobId) {
  console.error("[research-worker] Usage: research-worker.ts <firmId> <jobId>");
  process.exit(1);
}

executeResearchJob(firmId, jobId)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    // Fatal: ownership check failed or unhandled rejection.
    // Worker errors (Tavily/Claude failures) are handled inside executeResearchJob
    // and written to the job row — they do not reach here.
    console.error("[research-worker] Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
