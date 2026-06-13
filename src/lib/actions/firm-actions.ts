"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { firms } from "@/db/schema";
import type { CapabilityTag } from "@/lib/types";

const CreateFirmSchema = z.object({
  canonicalName: z
    .string()
    .trim()
    .min(1, "Firm name is required"),
  aliases: z.array(z.string().trim()).optional().default([]),
  companiesHouseNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  capabilityTags: z
    .array(z.enum(["Nuclear", "Infrastructure", "Construction"]))
    .default([]),
});

type CreateFirmInput = {
  canonicalName: string;
  aliases?: string[];
  companiesHouseNumber?: string;
  capabilityTags: CapabilityTag[];
};

type CreateFirmResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Server Action: insert a new firm into SQLite.
 *
 * Security (T-01-01):
 *  - All input validated by Zod before touching the DB
 *  - Drizzle uses parameterised queries — no raw SQL string concatenation
 *  - capabilityTags restricted to the known union (SQL-injection proof even
 *    for JSON-stored tags)
 *
 * This action runs server-side only; COMPANIES_HOUSE_API_KEY is never
 * exposed to the client (T-01-02).
 */
export async function createFirm(input: CreateFirmInput): Promise<CreateFirmResult> {
  // Validate with Zod (T-01-01 — Tampering mitigation)
  const parsed = CreateFirmSchema.safeParse(input);
  if (!parsed.success) {
    // Zod v4 uses .issues (not .errors)
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  const { canonicalName, aliases, companiesHouseNumber, capabilityTags } =
    parsed.data;

  try {
    const [inserted] = await db
      .insert(firms)
      .values({
        canonicalName,
        aliases: JSON.stringify(aliases),
        companiesHouseNumber: companiesHouseNumber ?? null,
        capabilityTags: JSON.stringify(capabilityTags),
      })
      .returning({ id: firms.id });

    if (!inserted) {
      return { ok: false, error: "Insert returned no row — unexpected DB error" };
    }

    revalidatePath("/firms");
    return { ok: true, id: inserted.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown database error";
    console.error("[createFirm] DB error:", message);
    return { ok: false, error: "Failed to save firm. Please try again." };
  }
}
