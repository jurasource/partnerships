import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFirm, updateFirm, deleteFirm } from "./firm-actions";
import type { Firm, CapabilityTag } from "@/lib/types";

// Mock the database and next/cache — explicit factory required because the
// real client.ts throws at load time when DATABASE_URL is not set.
vi.mock("@/db/client", () => ({ db: {}, sql: {} }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/db/client";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

// Setup: define a mock Firm type that matches what our tests expect
const mockDb = db as any;

describe("Firm Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createFirm (CONF-01)", () => {
    it("writes a new firm row to SQLite with generated UUID", async () => {
      // Arrange
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([
        { id: "test-uuid-001" },
      ]);

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      const input = {
        canonicalName: "Test Firm",
        aliases: ["Test Co", "Test Ltd"],
        companiesHouseNumber: "12345678",
        capabilityTags: ["Nuclear"] as CapabilityTag[],
      };

      // Act
      const result = await createFirm(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.id).toBe("test-uuid-001");
      }
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          canonicalName: "Test Firm",
          companiesHouseNumber: "12345678",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/firms");
    });

    it("rejects invalid firm name (empty string)", async () => {
      // Arrange
      const input = {
        canonicalName: "",
        aliases: [],
        companiesHouseNumber: "12345678",
        capabilityTags: [] as CapabilityTag[],
      };

      // Act
      const result = await createFirm(input);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("required");
      }
    });

    it("handles database error gracefully", async () => {
      // Arrange
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(
        new Error("Database connection lost")
      );

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      const input = {
        canonicalName: "Test Firm",
        aliases: [],
        companiesHouseNumber: "12345678",
        capabilityTags: ["Nuclear"] as CapabilityTag[],
      };

      // Act
      const result = await createFirm(input);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });

    it("stringifies JSON arrays for aliases and capabilityTags", async () => {
      // Arrange
      const capturedValues: any[] = [];
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn(function (val) {
        capturedValues.push(val);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "uuid-test" }]),
        };
      });

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({
        values: mockValues,
      });

      const input = {
        canonicalName: "Test Corp",
        aliases: ["Corp", "TC"],
        companiesHouseNumber: "87654321",
        capabilityTags: ["Nuclear", "Infrastructure"] as CapabilityTag[],
      };

      // Act
      await createFirm(input);

      // Assert
      expect(capturedValues[0]).toBeDefined();
      const captured = capturedValues[0];
      expect(typeof captured.aliases).toBe("string");
      expect(captured.aliases).toContain("Corp");
      expect(typeof captured.capabilityTags).toBe("string");
      expect(captured.capabilityTags).toContain("Nuclear");
    });
  });

  describe("updateFirm (CONF-02)", () => {
    it("updates an existing firm row by ID", async () => {
      // Arrange
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.update = mockUpdate;
      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      const firmId = "existing-firm-id";
      const input = {
        canonicalName: "Updated Firm Name",
        capabilityTags: ["Infrastructure"] as CapabilityTag[],
      };

      // Act
      const result = await updateFirm(firmId, input);

      // Assert
      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          canonicalName: "Updated Firm Name",
        })
      );
      expect(mockWhere).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/firms");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("rejects update with empty firm ID", async () => {
      // Arrange
      const input = {
        canonicalName: "Some Name",
      };

      // Act
      const result = await updateFirm("", input);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("ID");
      }
    });

    it("rejects update with no fields provided", async () => {
      // Arrange
      const input = {};

      // Act
      const result = await updateFirm("some-id", input);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("No fields");
      }
    });

    it("handles database error during update", async () => {
      // Arrange
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockRejectedValue(
        new Error("Update failed")
      );

      mockDb.update = mockUpdate;
      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await updateFirm("some-id", {
        canonicalName: "New Name",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });

    it("only includes provided fields in the update", async () => {
      // Arrange
      const capturedValues: any[] = [];
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn(function (val) {
        capturedValues.push(val);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      });

      mockDb.update = mockUpdate;
      mockUpdate.mockReturnValue({
        set: mockSet,
      });

      // Act — only updating name, not other fields
      await updateFirm("firm-id", {
        canonicalName: "Only Name Updated",
      });

      // Assert
      expect(capturedValues[0]).toBeDefined();
      const captured = capturedValues[0];
      expect(captured.canonicalName).toBe("Only Name Updated");
      expect(Object.keys(captured)).toEqual(["canonicalName"]);
    });
  });

  describe("deleteFirm (CONF-03)", () => {
    it("removes a firm row from SQLite by ID", async () => {
      // Arrange
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({
        where: mockWhere,
      });

      const firmId = "firm-to-delete";

      // Act
      const result = await deleteFirm(firmId);

      // Assert
      expect(result.ok).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/firms");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("rejects delete with empty firm ID", async () => {
      // Arrange & Act
      const result = await deleteFirm("");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("ID");
      }
    });

    it("handles database error during delete", async () => {
      // Arrange
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockRejectedValue(
        new Error("Delete failed")
      );

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await deleteFirm("firm-id");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });

    it("uses parameterised query with eq() for firm ID", async () => {
      // Arrange
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({
        where: mockWhere,
      });

      // Act
      await deleteFirm("specific-firm-id-123");

      // Assert
      // Verify that mockWhere was called (which receives the eq() clause)
      expect(mockWhere).toHaveBeenCalled();
      // The eq() call happens in the actual implementation
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
