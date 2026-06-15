import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addFirmToGroup,
  removeFirmFromGroup,
} from "./group-actions";

// Mock the database and next/cache — explicit factory required because the
// real client.ts throws at load time when DATABASE_URL is not set.
vi.mock("@/db/client", () => ({ db: {}, sql: {} }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/db/client";
import { revalidatePath } from "next/cache";

const mockDb = db as any;

describe("Group Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // createGroup
  // ---------------------------------------------------------------------------
  describe("createGroup", () => {
    it("inserts a group row and returns { ok: true, id }", async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([{ id: "group-uuid-001" }]);

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({ values: mockValues });
      mockValues.mockReturnValue({ returning: mockReturning });

      const result = await createGroup("Defence Primes");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.id).toBe("group-uuid-001");
      }
      expect(mockInsert).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/groups");
    });

    it("rejects empty/whitespace name with { ok: false, error }", async () => {
      // Track whether insert was called
      const mockInsert = vi.fn();
      mockDb.insert = mockInsert;

      const result = await createGroup("   ");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
      // Should NOT have attempted a DB insert
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("rejects empty string name", async () => {
      const result = await createGroup("");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("returns { ok: false, error } on DB error", async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(new Error("DB failure"));

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({ values: mockValues });
      mockValues.mockReturnValue({ returning: mockReturning });

      const result = await createGroup("Some Group");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updateGroup
  // ---------------------------------------------------------------------------
  describe("updateGroup", () => {
    it("sets name + updatedAt and returns { ok: true }", async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.update = mockUpdate;
      mockUpdate.mockReturnValue({ set: mockSet });
      mockSet.mockReturnValue({ where: mockWhere });

      const result = await updateGroup("group-id-123", "New Name");

      expect(result.ok).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Name" })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/groups");
    });

    it("includes updatedAt in the set payload", async () => {
      const capturedValues: any[] = [];
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn(function (val) {
        capturedValues.push(val);
        return { where: vi.fn().mockResolvedValue(undefined) };
      });

      mockDb.update = mockUpdate;
      mockUpdate.mockReturnValue({ set: mockSet });

      await updateGroup("group-id-123", "Another Name");

      expect(capturedValues[0]).toBeDefined();
      expect(capturedValues[0].updatedAt).toBeDefined();
      expect(typeof capturedValues[0].updatedAt).toBe("string");
    });

    it("rejects empty id with { ok: false, error }", async () => {
      const result = await updateGroup("", "New Name");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("rejects empty name with { ok: false, error }", async () => {
      const result = await updateGroup("some-id", "");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // deleteGroup
  // ---------------------------------------------------------------------------
  describe("deleteGroup", () => {
    it("deletes the group row and returns { ok: true }", async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({ where: mockWhere });

      const result = await deleteGroup("group-id-abc");

      expect(result.ok).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/groups");
    });

    it("rejects empty id with { ok: false, error }", async () => {
      const result = await deleteGroup("");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("returns { ok: false, error } on DB error", async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockRejectedValue(new Error("Delete failed"));

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({ where: mockWhere });

      const result = await deleteGroup("group-id-abc");

      expect(result.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // addFirmToGroup
  // ---------------------------------------------------------------------------
  describe("addFirmToGroup", () => {
    it("inserts a firmGroups row and returns { ok: true }", async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({ values: mockValues });
      mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflict });

      const result = await addFirmToGroup("firm-id-1", "group-id-1");

      expect(result.ok).toBe(true);
      expect(mockOnConflict).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/groups");
      expect(revalidatePath).toHaveBeenCalledWith("/firms");
    });

    it("is idempotent — calling twice does not throw (onConflictDoNothing)", async () => {
      // Both calls resolve without throwing — onConflictDoNothing handles duplicates
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({ values: mockValues });
      mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflict });

      const result1 = await addFirmToGroup("firm-id-1", "group-id-1");
      const result2 = await addFirmToGroup("firm-id-1", "group-id-1");

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      // onConflictDoNothing called once per invocation
      expect(mockOnConflict).toHaveBeenCalledTimes(2);
    });

    it("rejects empty firmId with { ok: false, error }", async () => {
      const result = await addFirmToGroup("", "group-id-1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("rejects empty groupId with { ok: false, error }", async () => {
      const result = await addFirmToGroup("firm-id-1", "");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // removeFirmFromGroup
  // ---------------------------------------------------------------------------
  describe("removeFirmFromGroup", () => {
    it("deletes the matching firmGroups row and returns { ok: true }", async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({ where: mockWhere });

      const result = await removeFirmFromGroup("firm-id-1", "group-id-1");

      expect(result.ok).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/groups");
      expect(revalidatePath).toHaveBeenCalledWith("/firms");
    });

    it("rejects empty firmId with { ok: false, error }", async () => {
      const result = await removeFirmFromGroup("", "group-id-1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("rejects empty groupId with { ok: false, error }", async () => {
      const result = await removeFirmFromGroup("firm-id-1", "");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("returns { ok: false, error } on DB error", async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockRejectedValue(new Error("Delete failed"));

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({ where: mockWhere });

      const result = await removeFirmFromGroup("firm-id-1", "group-id-1");

      expect(result.ok).toBe(false);
    });
  });
});
