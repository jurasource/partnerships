"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { topics } from "@/db/schema";

const TopicSchema = z.object({
  name: z.string().trim().min(1, "Topic name is required"),
  description: z.string().trim().optional().default(""),
  searchTerms: z.string().trim().optional().default(""),
});

const UpdateTopicSchema = z.object({
  name: z.string().trim().min(1, "Topic name is required").optional(),
  description: z.string().trim().optional(),
  searchTerms: z.string().trim().optional(),
});

type CreateTopicInput = {
  name: string;
  description?: string;
  searchTerms?: string;
};

type UpdateTopicInput = {
  name?: string;
  description?: string;
  searchTerms?: string;
};

type CreateTopicResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Server Action: insert a new research topic.
 *
 * Security (T-01-05):
 *  - Zod-validates input before any DB mutation
 *  - Drizzle uses parameterised queries — no raw SQL interpolation
 */
export async function createTopic(input: CreateTopicInput): Promise<CreateTopicResult> {
  const parsed = TopicSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  const { name, description, searchTerms } = parsed.data;

  try {
    const [inserted] = await db
      .insert(topics)
      .values({ name, description, searchTerms })
      .returning({ id: topics.id });

    if (!inserted) {
      return { ok: false, error: "Insert returned no row — unexpected DB error" };
    }

    revalidatePath("/topics");
    return { ok: true, id: inserted.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown database error";
    console.error("[createTopic] DB error:", message);
    return { ok: false, error: "Failed to save topic. Please try again." };
  }
}

/**
 * Server Action: update an existing research topic.
 *
 * Security (T-01-05):
 *  - Zod-validates input; parameterised Drizzle eq(topics.id, id)
 */
export async function updateTopic(
  id: string,
  input: UpdateTopicInput
): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Topic ID is required." };

  const parsed = UpdateTopicSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  const { name, description, searchTerms } = parsed.data;

  const updateValues: Record<string, unknown> = {};
  if (name !== undefined) updateValues.name = name;
  if (description !== undefined) updateValues.description = description;
  if (searchTerms !== undefined) updateValues.searchTerms = searchTerms;

  if (Object.keys(updateValues).length === 0) {
    return { ok: false, error: "No fields to update." };
  }

  try {
    await db.update(topics).set(updateValues).where(eq(topics.id, id));

    revalidatePath("/topics");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown database error";
    console.error("[updateTopic] DB error:", message);
    return { ok: false, error: "Failed to update topic. Please try again." };
  }
}

/**
 * Server Action: delete a research topic by ID.
 *
 * Security (T-01-05):
 *  - Parameterised Drizzle eq(topics.id, id) — no raw SQL interpolation
 *  - Gated by AlertDialog confirmation in the UI (T-01-06)
 */
export async function deleteTopic(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Topic ID is required." };

  try {
    await db.delete(topics).where(eq(topics.id, id));

    revalidatePath("/topics");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown database error";
    console.error("[deleteTopic] DB error:", message);
    return { ok: false, error: "Failed to delete topic. Please try again." };
  }
}
