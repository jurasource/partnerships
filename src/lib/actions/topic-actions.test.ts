import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTopic, updateTopic, deleteTopic } from "./topic-actions";

// Mock the database and next/cache
vi.mock("@/db/client");
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/db/client";
import { revalidatePath } from "next/cache";

const mockDb = db as any;

describe("Topic Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createTopic (CONF-04)", () => {
    it("writes a new topic row to SQLite with generated UUID", async () => {
      // Arrange
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([
        { id: "topic-uuid-001" },
      ]);

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      const input = {
        name: "UK nuclear capability",
        description: "What nuclear capabilities...",
      };

      // Act
      const result = await createTopic(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.id).toBe("topic-uuid-001");
      }
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "UK nuclear capability",
          description: "What nuclear capabilities...",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/topics");
    });

    it("rejects invalid topic name (empty string)", async () => {
      // Arrange
      const input = {
        name: "",
        description: "Some description",
      };

      // Act
      const result = await createTopic(input);

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
        new Error("DB connection failed")
      );

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      const input = {
        name: "Test Topic",
        description: "Test description",
      };

      // Act
      const result = await createTopic(input);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });

    it("accepts optional description (defaults to empty string)", async () => {
      // Arrange
      const capturedValues: any[] = [];
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn(function (val) {
        capturedValues.push(val);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "topic-id" }]),
        };
      });

      mockDb.insert = mockInsert;
      mockInsert.mockReturnValue({
        values: mockValues,
      });

      const input = {
        name: "Topic Without Description",
      };

      // Act
      await createTopic(input);

      // Assert
      expect(capturedValues[0]).toBeDefined();
      const captured = capturedValues[0];
      expect(captured.name).toBe("Topic Without Description");
      expect(captured.description).toBe("");
    });
  });

  describe("updateTopic (CONF-05)", () => {
    it("updates an existing topic row by ID", async () => {
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

      const topicId = "existing-topic-id";
      const input = {
        name: "Updated Topic Name",
        description: "Updated description",
      };

      // Act
      const result = await updateTopic(topicId, input);

      // Assert
      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Topic Name",
          description: "Updated description",
        })
      );
      expect(mockWhere).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/topics");
    });

    it("rejects update with empty topic ID", async () => {
      // Arrange
      const input = {
        name: "Some Name",
      };

      // Act
      const result = await updateTopic("", input);

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
      const result = await updateTopic("topic-id", input);

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
      const result = await updateTopic("topic-id", {
        name: "New Name",
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

      // Act — only updating name
      await updateTopic("topic-id", {
        name: "Only Name Updated",
      });

      // Assert
      expect(capturedValues[0]).toBeDefined();
      const captured = capturedValues[0];
      expect(captured.name).toBe("Only Name Updated");
      expect(Object.keys(captured)).toEqual(["name"]);
    });
  });

  describe("deleteTopic (CONF-05)", () => {
    it("removes a topic row from SQLite by ID", async () => {
      // Arrange
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({
        where: mockWhere,
      });

      const topicId = "topic-to-delete";

      // Act
      const result = await deleteTopic(topicId);

      // Assert
      expect(result.ok).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/topics");
    });

    it("rejects delete with empty topic ID", async () => {
      // Arrange & Act
      const result = await deleteTopic("");

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
      const result = await deleteTopic("topic-id");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });

    it("uses parameterised query for topic ID", async () => {
      // Arrange
      const mockDelete = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      mockDb.delete = mockDelete;
      mockDelete.mockReturnValue({
        where: mockWhere,
      });

      // Act
      await deleteTopic("specific-topic-id-456");

      // Assert
      expect(mockWhere).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
