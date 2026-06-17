import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { requestLogs, firms, topics } from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [row] = await db
      .select({
        id: requestLogs.id,
        type: requestLogs.type,
        createdAt: requestLogs.createdAt,
        jobId: requestLogs.jobId,
        firmId: requestLogs.firmId,
        topicId: requestLogs.topicId,
        searchQuery: requestLogs.searchQuery,
        searchResultsJson: requestLogs.searchResultsJson,
        model: requestLogs.model,
        promptJson: requestLogs.promptJson,
        rawResponse: requestLogs.rawResponse,
        inputTokens: requestLogs.inputTokens,
        outputTokens: requestLogs.outputTokens,
        cacheCreatedTokens: requestLogs.cacheCreatedTokens,
        cacheReadTokens: requestLogs.cacheReadTokens,
        finishReason: requestLogs.finishReason,
        isRetry: requestLogs.isRetry,
        durationMs: requestLogs.durationMs,
        errorMessage: requestLogs.errorMessage,
        firmName: firms.canonicalName,
        topicName: topics.name,
      })
      .from(requestLogs)
      .leftJoin(firms, eq(requestLogs.firmId, firms.id))
      .leftJoin(topics, eq(requestLogs.topicId, topics.id))
      .where(eq(requestLogs.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    console.error("[api/request-logs/[id]] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await db.delete(requestLogs).where(eq(requestLogs.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/request-logs/[id]] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
