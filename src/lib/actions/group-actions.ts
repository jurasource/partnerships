"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { groups, firmGroups } from "@/db/schema";

const NameSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
});

type CreateGroupResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Server Action: create a new group.
 *
 * - Validates name via Zod (empty/whitespace rejected)
 * - Returns { ok: true, id } on success
 * - Returns { ok: false, error } on validation failure or DB error
 * - Calls revalidatePath("/groups") so the groups page reflects the new row
 */
export async function createGroup(name: string): Promise<CreateGroupResult> {
  const parsed = NameSchema.safeParse({ name });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  try {
    const [inserted] = await db
      .insert(groups)
      .values({ name: parsed.data.name })
      .returning({ id: groups.id });

    if (!inserted) {
      return { ok: false, error: "Insert returned no row — unexpected DB error" };
    }

    revalidatePath("/groups");
    return { ok: true, id: inserted.id };
  } catch (err) {
    // Postgres unique-constraint violation: error code 23505
    if (err instanceof Error && (err as { code?: string }).code === "23505") {
      return { ok: false, error: "A group with that name already exists." };
    }
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("[createGroup] DB error:", message);
    return { ok: false, error: "Failed to save group. Please try again." };
  }
}

/**
 * Server Action: rename an existing group.
 *
 * - Guards against empty id
 * - Validates name via Zod
 * - Sets name + updatedAt on the row
 * - Returns { ok: true } on success
 */
export async function updateGroup(id: string, name: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Group ID is required." };

  const parsed = NameSchema.safeParse({ name });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  try {
    await db
      .update(groups)
      .set({ name: parsed.data.name, updatedAt: new Date().toISOString() })
      .where(eq(groups.id, id));

    revalidatePath("/groups");
    revalidatePath(`/groups/${id}`, "page");
    return { ok: true };
  } catch (err) {
    // Postgres unique-constraint violation: error code 23505
    if (err instanceof Error && (err as { code?: string }).code === "23505") {
      return { ok: false, error: "A group with that name already exists." };
    }
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("[updateGroup] DB error:", message);
    return { ok: false, error: "Failed to update group. Please try again." };
  }
}

/**
 * Server Action: delete a group by ID.
 *
 * firmGroups rows cascade via the FK onDelete:"cascade" defined in the schema,
 * so no explicit junction cleanup is needed here.
 */
export async function deleteGroup(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Group ID is required." };

  try {
    await db.delete(groups).where(eq(groups.id, id));

    revalidatePath("/groups");
    revalidatePath("/firms");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("[deleteGroup] DB error:", message);
    return { ok: false, error: "Failed to delete group. Please try again." };
  }
}

/**
 * Server Action: add a firm to a group.
 *
 * Idempotent: onConflictDoNothing means a second call for the same
 * (firmId, groupId) pair silently succeeds without throwing.
 */
export async function addFirmToGroup(firmId: string, groupId: string): Promise<ActionResult> {
  if (!firmId) return { ok: false, error: "Firm ID is required." };
  if (!groupId) return { ok: false, error: "Group ID is required." };

  try {
    await db
      .insert(firmGroups)
      .values({ firmId, groupId })
      .onConflictDoNothing();

    revalidatePath("/groups");
    revalidatePath("/firms");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("[addFirmToGroup] DB error:", message);
    return { ok: false, error: "Failed to add firm to group. Please try again." };
  }
}

/**
 * Server Action: remove a firm from a group.
 *
 * Deletes the exact (firmId, groupId) junction row.
 */
export async function removeFirmFromGroup(firmId: string, groupId: string): Promise<ActionResult> {
  if (!firmId) return { ok: false, error: "Firm ID is required." };
  if (!groupId) return { ok: false, error: "Group ID is required." };

  try {
    await db
      .delete(firmGroups)
      .where(and(eq(firmGroups.firmId, firmId), eq(firmGroups.groupId, groupId)));

    revalidatePath("/groups");
    revalidatePath("/firms");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("[removeFirmFromGroup] DB error:", message);
    return { ok: false, error: "Failed to remove firm from group. Please try again." };
  }
}
