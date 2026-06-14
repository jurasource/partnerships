import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchContractsFinder } from "./contracts-finder";
import type { Firm } from "@/lib/types";

// Mock rateLimitedFetch
vi.mock("./http", () => ({
  rateLimitedFetch: vi.fn(),
}));

import { rateLimitedFetch } from "./http";

const mockFetch = rateLimitedFetch as any;

describe("Contracts Finder Client (DATA-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockFirm: Firm = {
    id: "firm-1",
    canonicalName: "AtkinsRéalis",
    aliases: JSON.stringify(["Atkins", "SNC-Lavalin"]),
    companiesHouseNumber: "01093549",
    capabilityTags: JSON.stringify(["Nuclear"]),
    createdAt: "2026-06-14",
    updatedAt: "2026-06-14",
    lastResearchedAt: null,
  };

  describe("fetchContractsFinder pagination", () => {
    it("paginates through results using page and page_size parameters", async () => {
      // Arrange: Return 100 items on page 1 to trigger pagination
      // Return full 100 on page 2, then empty on page 3 to stop
      const page1Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 1).padStart(3, "0")}`,
        date: "2025-03-01T00:00:00Z",
        tender: { title: `Notice ${i + 1}` },
      }));

      const page2Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 101).padStart(3, "0")}`,
        date: "2025-03-02T00:00:00Z",
        tender: { title: `Notice ${i + 101}` },
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page1Releases,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page2Releases,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: [],
          }),
        });

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify page parameters in URLs
      const call1 = mockFetch.mock.calls[0][0];
      const call2 = mockFetch.mock.calls[1][0];

      expect(call1).toContain("page=1");
      expect(call2).toContain("page=2");
      expect(call1).toContain("page_size=100");
      expect(call2).toContain("page_size=100");

      // Result should contain 200 releases from pages 1 and 2
      expect(result).toHaveLength(200);
    });

    it("stops paginating when a page returns fewer than page_size results", async () => {
      // Arrange: Full page 1, then partial page 2 to trigger stop
      const page1Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 1).padStart(3, "0")}`,
        date: "2025-03-01T00:00:00Z",
        tender: { title: `Notice ${i + 1}` },
      }));

      const page2Releases = [
        {
          ocid: "ocds-b5fd17-101",
          date: "2025-03-02T00:00:00Z",
          tender: { title: "Notice 101" },
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page1Releases,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page2Releases,
          }),
        });

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(101);
    });

    it("respects MAX_PAGES safety cap (does not exceed 10 pages)", async () => {
      // Arrange: Return full pages to avoid the "fewer than page_size" break
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: Array.from({ length: 100 }, (_, i) => ({
            ocid: `ocds-b5fd17-${i}`,
            date: "2025-03-01T00:00:00Z",
            tender: { title: `Notice ${i}` },
          })),
        }),
      };

      // Mock 15 pages to test the cap
      for (let i = 0; i < 15; i++) {
        mockFetch.mockResolvedValueOnce(mockResponse);
      }

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      // Should stop at MAX_PAGES (10)
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it("stops paginating on HTTP error (after first page)", async () => {
      // Arrange: Full page 1, then error on page 2
      const page1Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 1).padStart(3, "0")}`,
        date: "2025-03-01T00:00:00Z",
        tender: { title: `Notice ${i + 1}` },
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page1Releases,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should return what was successfully fetched
      expect(result).toHaveLength(100);
    });

    it("throws error if first page fails (no partial results)", async () => {
      // Arrange
      const errorResponse = {
        ok: false,
        status: 500,
      };
      mockFetch.mockResolvedValueOnce(errorResponse);

      // Act & Assert
      await expect(fetchContractsFinder(mockFirm)).rejects.toThrow(
        /Contracts Finder request failed/
      );
    });
  });

  describe("fetchContractsFinder returns raw OCDS releases", () => {
    it("returns array of raw OCDS releases from response", async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: [
            {
              ocid: "ocds-b5fd17-001",
              date: "2025-03-01T00:00:00Z",
              tender: { title: "Procurement Notice" },
              awards: [
                {
                  suppliers: [
                    {
                      name: "Test Supplier",
                      identifier: { scheme: "GB-COH", id: "01093549" },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].ocid).toBe("ocds-b5fd17-001");
      expect(result[0].tender).toBeDefined();
      expect(result[0].awards).toBeDefined();
    });

    it("returns empty array for firm with empty canonicalName", async () => {
      // Arrange
      const emptyFirm: Firm = {
        ...mockFirm,
        canonicalName: "",
      };

      // Act
      const result = await fetchContractsFinder(emptyFirm);

      // Assert
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles response with results array containing releases", async () => {
      // Arrange: Different response structure (results wrapper)
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              releases: [
                {
                  ocid: "ocds-b5fd17-001",
                  date: "2025-03-01T00:00:00Z",
                  tender: { title: "Notice 1" },
                },
              ],
            },
            {
              releases: [
                {
                  ocid: "ocds-b5fd17-002",
                  date: "2025-03-02T00:00:00Z",
                  tender: { title: "Notice 2" },
                },
              ],
            },
          ],
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].ocid).toBe("ocds-b5fd17-001");
      expect(result[1].ocid).toBe("ocds-b5fd17-002");
    });

    it("handles JSON parse error by stopping pagination gracefully", async () => {
      // Arrange
      const page1Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 1).padStart(3, "0")}`,
        date: "2025-03-01T00:00:00Z",
        tender: { title: `Notice ${i + 1}` },
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page1Releases,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error("Invalid JSON");
          },
        });

      // Act
      const result = await fetchContractsFinder(mockFirm);

      // Assert
      // Should return results from page 1 without throwing
      expect(result).toHaveLength(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("includes firm canonical name in search term", async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: [],
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Act
      await fetchContractsFinder(mockFirm);

      // Assert
      const url = mockFetch.mock.calls[0][0];
      // The firm's canonical name should be in the searchTerm parameter
      expect(url).toContain("searchTerm=");
      expect(url).toContain(encodeURIComponent("AtkinsRéalis"));
    });
  });
});
