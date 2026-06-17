import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

import { getConsortiumPromptData } from "@/lib/queries/consortium-prompt-data";
import { assembleConsortiumPrompt } from "@/lib/consortium/assemble-prompt";

const ConsortiumPromptRequestSchema = z.object({
  firmIds: z.array(z.string().uuid()).min(1).max(50),
  opportunity: z.object({
    name: z.string().trim().min(1, "Opportunity name required").max(200),
    description: z.string().trim().max(2000).default(""),
  }),
  roles: z.array(
    z.object({
      id: z.string(),
      title: z.string().trim().min(1).max(100),
      description: z.string().trim().max(500).default(""),
    }),
  ).min(1).max(8),
  anchorFirmId: z.string().uuid().nullable().default(null),
  constraints: z.object({
    ukOwned: z.boolean().default(false),
    noHighRisk: z.boolean().default(false),
    priorNuclear: z.boolean().default(false),
    freeText: z.string().max(500).default(""),
  }),
  include: z.object({
    findings: z.boolean().default(true),
    riskFlags: z.boolean().default(true),
    partnerships: z.boolean().default(true),
    ownership: z.boolean().default(true),
  }),
  model: z.enum([
    "claude-sonnet-4-6",
    "claude-opus-4-8",
    "claude-haiku-4-5-20251001",
  ]).default("claude-sonnet-4-6"),
});

export type ConsortiumPromptRequest = z.infer<typeof ConsortiumPromptRequestSchema>;

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const isStream = req.nextUrl.searchParams.get("stream") === "true";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ConsortiumPromptRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { firmIds, opportunity, roles, anchorFirmId, constraints, include, model } = parsed.data;

  try {
    const firmContexts = await getConsortiumPromptData(firmIds, include);

    const prompt = assembleConsortiumPrompt({
      opportunity,
      roles,
      anchorFirmId,
      constraints,
      firms: firmContexts,
      include,
    });

    if (!isStream) {
      return NextResponse.json({ prompt });
    }

    const result = streamText({
      model: anthropic(model),
      prompt,
      maxOutputTokens: 4096,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assemble prompt";
    console.error("[consortium-prompt] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
