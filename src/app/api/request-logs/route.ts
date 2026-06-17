import { NextRequest, NextResponse } from "next/server";
import { desc, lt, and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { requestLogs, firms, topics } from "@/db/schema";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "";
  const firmId = searchParams.get("firmId") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
  const before = searchParams.get("before") ?? "";

  try {
    const conditions = [];
    if (type === "tavily_search" || type === "llm_call") {
      conditions.push(eq(requestLogs.type, type));
    }
    if (firmId) {
      conditions.push(eq(requestLogs.firmId, firmId));
    }
    if (before) {
      conditions.push(lt(requestLogs.createdAt, before));
    }

    const rows = await db
      .select({
        id: requestLogs.id,
        type: requestLogs.type,
        createdAt: requestLogs.createdAt,
        jobId: requestLogs.jobId,
        firmId: requestLogs.firmId,
        topicId: requestLogs.topicId,
        // Tavily fields
        searchQuery: requestLogs.searchQuery,
        // LLM fields
        model: requestLogs.model,
        inputTokens: requestLogs.inputTokens,
        outputTokens: requestLogs.outputTokens,
        cacheCreatedTokens: requestLogs.cacheCreatedTokens,
        cacheReadTokens: requestLogs.cacheReadTokens,
        finishReason: requestLogs.finishReason,
        isRetry: requestLogs.isRetry,
        // Shared
        durationMs: requestLogs.durationMs,
        errorMessage: requestLogs.errorMessage,
        // Join names for display
        firmName: firms.canonicalName,
        topicName: topics.name,
      })
      .from(requestLogs)
      .leftJoin(firms, eq(requestLogs.firmId, firms.id))
      .leftJoin(topics, eq(requestLogs.topicId, topics.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(requestLogs.createdAt))
      .limit(limit);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/request-logs] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { before?: string };
    const { before } = body;

    if (before) {
      await db.delete(requestLogs).where(lt(requestLogs.createdAt, before));
    } else {
      await db.delete(requestLogs);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/request-logs] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
