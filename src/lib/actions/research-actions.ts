"use server";

import { spawn } from "child_process";
import path from "path";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { firms } from "@/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";

/**
 * runResearch — enqueues a research job and spawns a detached worker process.
 *
 * Returns immediately after spawn. The worker runs in a separate Node.js
 * process so the Next.js server event loop stays responsive while Tavily +
 * Claude API calls run sequentially for each topic (7 × ~3 s).
 *
 * The worker inherits process.env (including API keys loaded from .env.local)
 * and runs with --conditions react-server so that `import "server-only"` in
 * the research modules resolves to an empty shim rather than throwing.
 *
 * Guards (RES-01, DATA-04):
 * - Firm must exist in the DB.
 * - Firm must have a Companies House number before research is triggered.
 */
export async function runResearch(
  firmId: string,
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const [firm] = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) {
    return { ok: false, error: "Firm not found." };
  }

  if (!firm.companiesHouseNumber) {
    return {
      ok: false,
      error: "Add a Companies House number before running research.",
    };
  }

  const jobId = await enqueueJob({ firmId });

  const workerScript = path.join(process.cwd(), "src", "scripts", "research-worker.ts");
  const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");

  // Extend NODE_OPTIONS to activate the react-server export condition.
  // This makes `import "server-only"` in the research modules resolve to the
  // empty shim (empty.js) instead of the throwing index.js — required when
  // running outside the Next.js bundler context.
  const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
  const nodeOptions = `--conditions react-server${existingNodeOptions ? ` ${existingNodeOptions}` : ""}`;

  const child = spawn(tsxBin, [workerScript, firmId, jobId], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
  });

  // Unref so the Next.js process doesn't wait for the worker to exit.
  child.unref();

  return { ok: true, jobId };
}
