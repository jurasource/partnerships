"use server";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { accessCodes } from "@/db/schema";
import { verifyCode } from "@/lib/auth/hash";
import { setSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

export async function verifyAccessCode(formData: FormData): Promise<{ error: string } | never> {
  const input = (formData.get("code") as string | null)?.trim() ?? "";
  if (!input) return { error: "Access code is required." };

  const candidates = await db
    .select()
    .from(accessCodes)
    .where(and(eq(accessCodes.active, true)));

  for (const candidate of candidates) {
    const match = await verifyCode(input, candidate.codeHash);
    if (match) {
      // Check expiry
      if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
      // Update lastUsedAt (fire-and-forget; non-critical)
      db.update(accessCodes)
        .set({ lastUsedAt: new Date() })
        .where(eq(accessCodes.id, candidate.id))
        .catch(() => {});
      await setSession();
      redirect("/");
    }
  }

  // Generic error — no hint whether code exists or is expired
  return { error: "Invalid access code. Please try again." };
}
