"use server";

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export type GenerateAliasesActionResult =
  | { ok: true; suggestions: string[] }
  | { ok: false; error: string };

export async function generateAliasesAction(
  firmName: string,
  registeredName: string,
  previousNames: string[],
): Promise<GenerateAliasesActionResult> {
  try {
    const knownNames = [firmName, registeredName, ...previousNames]
      .filter(Boolean)
      .filter((n, i, arr) => arr.indexOf(n) === i);

    const { object } = await generateObject({
      model: anthropic("claude-opus-4-8"),
      schema: z.object({
        suggestions: z
          .array(z.string())
          .describe("Alias suggestions not already in the known names list"),
      }),
      prompt: `You are helping build a UK civil nuclear firm intelligence database.

For the company "${firmName}" (registered as "${registeredName}"), suggest additional aliases that would help identify this firm in documents, contracts, and news articles. These might include:
- Common abbreviations (e.g. "AtkinsRéalis" → "Atkins")
- Trading names different from the legal name
- Parent or group company names this firm is commonly known under
- Short-form versions used in the sector
- Prior brand names not already listed

Already known names (DO NOT suggest these): ${knownNames.map((n) => `"${n}"`).join(", ")}

Return 3–6 additional alias suggestions only. Return an empty array if no good additional aliases exist. Only suggest aliases that a knowledgeable person would reasonably associate with this specific firm — do not fabricate names.`,
    });

    return { ok: true, suggestions: object.suggestions };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI alias generation failed.";
    return { ok: false, error: message };
  }
}
