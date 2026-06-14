import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFindATender } from "./find-a-tender";
import type { Firm } from "@/lib/types";

// Mock rateLimitedFetch
vi.mock("./http", () => ({
  rateLimitedFetch: vi.fn(),
}));

import { rateLimitedFetch } from "./http";

const mockFetch = rateLimitedFetch as any;

describe("Find a Tender Client (DATA-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockFirm: Firm = {
    id: "firm-1",
    canonicalName: "Rolls-Royce SMR",
    aliases: JSON.stringify(["RR SMR", "Rolls-Royce Small Modular Reactors"]),
    companiesHouseNumber: "11715682",
    capabilityTags: JSON.stringify(["Nuclear"]),
    createdAt: "2026-06-14",
    updatedAt: "2026-06-14",
    lastResearchedAt: null,
  };

  describe("fetchFindATender pagination via links.next", () => {
    it("follows links.next cursor to paginate through releases", async () => {
      // Arrange: Return full 100-item releases to trigger cursor following
      const page1Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 1).padStart(3, "0")}`,
        date: "2025-03-01T00:00:00Z",
        tender: { title: `FTS Notice ${i + 1}` },
      }));

      const page2Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 101).padStart(3, "0")}`,
        date: "2025-03-02T00:00:00Z",
        tender: { title: `FTS Notice ${i + 101}` },
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page1Releases,
            links: {
              next: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&offset=100",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page2Releases,
            links: {
              next: null,
            },
          }),
        });

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // First call should use the base URL
      const firstCall = mockFetch.mock.calls[0][0];
      expect(firstCall).toContain("https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages");
      expect(firstCall).toContain("limit=100");

      // Second call should use the links.next URL
      const secondCall = mockFetch.mock.calls[1][0];
      expect(secondCall).toBe(
        "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&offset=100"
      );

      // Result should contain 200 releases from both pages
      expect(result).toHaveLength(200);
    });

    it("stops paginating when links.next is null or missing", async () => {
      // Arrange
      const page1Response = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: [
            {
              ocid: "ocds-b5fd17-001",
              date: "2025-03-01T00:00:00Z",
              tender: { title: "FTS Notice 1" },
            },
          ],
          links: null, // No next link
        }),
      };

      mockFetch.mockResolvedValueOnce(page1Response);

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it("guards against SSRF by validating links.next origin", async () => {
      // Arrange
      const page1Response = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: [
            {
              ocid: "ocds-b5fd17-001",
              date: "2025-03-01T00:00:00Z",
              tender: { title: "Notice 1" },
            },
          ],
          links: {
            // Malicious next link to external host
            next: "https://evil.com/api/steal-data",
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(page1Response);

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      // Should stop pagination and not follow the evil link
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      // Verify evil.com was never called
      const calls = mockFetch.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((url: string) => url.includes("evil.com"))).toBe(false);
    });

    it("respects MAX_PAGES safety cap (does not exceed 10 pages)", async () => {
      // Arrange: Create a chain of 15 pages
      let nextUrl = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100";
      const pages = [];

      for (let i = 0; i < 15; i++) {
        const nextNextUrl =
          i < 14
            ? `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&offset=${(i + 1) * 100}`
            : null;

        pages.push({
          ok: true,
          json: vi
            .fn()
            .mockResolvedValue({
              releases: [
                {
                  ocid: `ocds-b5fd17-${i}`,
                  date: "2025-03-01T00:00:00Z",
                  tender: { title: `Notice ${i}` },
                },
              ],
              links: nextNextUrl ? { next: nextNextUrl } : { next: null },
            }),
        });
      }

      mockFetch.mockResolvedValue(pages[0]);
      for (let i = 1; i < pages.length; i++) {
        mockFetch.mockResolvedValueOnce(pages[i]);
      }

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(10);
      expect(result).toHaveLength(10);
    });

    it("stops pagination on HTTP error", async () => {
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
            links: {
              next: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?offset=100",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      // Act
      const result = await fetchFindATender(mockFirm);

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
      await expect(fetchFindATender(mockFirm)).rejects.toThrow(
        /Find a Tender request failed/
      );
    });
  });

  describe("fetchFindATender returns raw OCDS releases", () => {
    it("returns array of raw OCDS releases from response", async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: [
            {
              ocid: "ocds-b5fd17-001",
              date: "2025-03-01T00:00:00Z",
              tender: { title: "FTS Procurement Notice" },
              awards: [
                {
                  suppliers: [
                    {
                      name: "Test Supplier",
                      identifier: { scheme: "GB-COH", id: "11715682" },
                    },
                  ],
                },
              ],
            },
          ],
          links: null,
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchFindATender(mockFirm);

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
      const result = await fetchFindATender(emptyFirm);

      // Assert
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("accumulates releases from multiple pages into single array", async () => {
      // Arrange
      const page1Releases = Array.from({ length: 100 }, (_, i) => ({
        ocid: `ocds-b5fd17-${String(i + 1).padStart(3, "0")}`,
        date: "2025-03-01T00:00:00Z",
        tender: { title: `Notice ${i + 1}` },
      }));

      const page2Releases = [
        {
          ocid: "ocds-b5fd17-101",
          date: "2025-03-03T00:00:00Z",
          tender: { title: "Notice 101" },
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page1Releases,
            links: {
              next: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?offset=100",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            releases: page2Releases,
            links: null,
          }),
        });

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      expect(result).toHaveLength(101);
      expect(result[0].ocid).toBe("ocds-b5fd17-001");
      expect(result[99].ocid).toBe("ocds-b5fd17-100");
      expect(result[100].ocid).toBe("ocds-b5fd17-101");
    });

    it("handles empty releases array in response", async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          releases: [],
          links: null,
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      expect(result).toHaveLength(0);
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
            links: {
              next: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?offset=100",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error("Invalid JSON");
          },
        });

      // Act
      const result = await fetchFindATender(mockFirm);

      // Assert
      // Should return results from page 1 without throwing
      expect(result).toHaveLength(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
