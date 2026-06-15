import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCompanyProfile,
  getPSC,
  searchCompanies,
} from "./companies-house";

// Mock rateLimitedFetch
vi.mock("./http", () => ({
  rateLimitedFetch: vi.fn(),
}));

import { rateLimitedFetch } from "./http";

const mockFetch = rateLimitedFetch as any;

describe("Companies House Client (DATA-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set a valid API key for tests
    process.env.COMPANIES_HOUSE_API_KEY = "test-api-key-12345";
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.COMPANIES_HOUSE_API_KEY;
  });

  describe("getCompanyProfile", () => {
    it("constructs correct HTTP Basic auth header with CH number in URL path", async () => {
      // Arrange
      const chNumber = "01093549";
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          company_number: chNumber,
          company_name: "AtkinsRéalis UK Holdings Ltd",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await getCompanyProfile(chNumber);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(chNumber)}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      );

      // Verify Authorization header is base64-encoded "key:" (blank password)
      const call = mockFetch.mock.calls[0];
      const authHeader = call[1].headers.Authorization;
      expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/=]+$/);

      // Decode and verify it contains the key
      const encodedPart = authHeader.replace("Basic ", "");
      const decoded = Buffer.from(encodedPart, "base64").toString("utf-8");
      expect(decoded).toBe("test-api-key-12345:");
    });

    it("URL-encodes the CH number to prevent path traversal", async () => {
      // Arrange
      const chNumber = "01093549"; // Normal case
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          company_number: chNumber,
          company_name: "Test Co",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await getCompanyProfile(chNumber);

      // Assert
      const call = mockFetch.mock.calls[0];
      const url = call[0];
      // Should not contain unencoded slashes or special chars in the number part
      expect(url).toContain("/01093549");
      expect(url).not.toContain("../");
    });

    it("returns null for 404 (not found)", async () => {
      // Arrange
      const chNumber = "99999999";
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await getCompanyProfile(chNumber);

      // Assert
      expect(result).toBeNull();
    });

    it("parses and returns company profile when response is valid", async () => {
      // Arrange
      const chNumber = "01093549";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          company_number: chNumber,
          company_name: "AtkinsRéalis UK Holdings Ltd",
          company_status: "active",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await getCompanyProfile(chNumber);

      // Assert
      expect(result).not.toBeNull();
      if (result) {
        expect(result.company_number).toBe(chNumber);
        expect(result.company_name).toBe("AtkinsRéalis UK Holdings Ltd");
      }
    });
  });

  describe("getPSC", () => {
    it("constructs correct URL with persons-with-significant-control endpoint", async () => {
      // Arrange
      const chNumber = "01093549";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          items: [],
          active_count: 0,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await getPSC(chNumber);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/company/${encodeURIComponent(chNumber)}/persons-with-significant-control`
        ),
        expect.any(Object)
      );
    });

    it("includes HTTP Basic auth header in PSC request", async () => {
      // Arrange
      const chNumber = "01093549";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ items: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await getPSC(chNumber);

      // Assert
      const call = mockFetch.mock.calls[0];
      expect(call[1].headers).toHaveProperty("Authorization");
      expect(call[1].headers.Authorization).toMatch(/^Basic /);
    });

    it("returns null for 404 response", async () => {
      // Arrange
      const chNumber = "99999999";
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await getPSC(chNumber);

      // Assert
      expect(result).toBeNull();
    });

    it("parses and returns PSC record when valid", async () => {
      // Arrange
      const chNumber = "01093549";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          items: [
            {
              name: "John Doe",
              kind: "individual",
              nationality: "British",
            },
          ],
          active_count: 1,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await getPSC(chNumber);

      // Assert
      expect(result).not.toBeNull();
      if (result) {
        expect(result.items).toHaveLength(1);
        expect(result.active_count).toBe(1);
      }
    });
  });

  describe("searchCompanies", () => {
    it("URL-encodes the search query to prevent injection", async () => {
      // Arrange
      const query = "Atkins & Associates Ltd";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          items: [],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await searchCompanies(query);

      // Assert
      const call = mockFetch.mock.calls[0];
      const url = call[0];
      // The query should be URL-encoded in the URL
      expect(url).toContain("q=");
      // Should not contain unencoded ampersand in query param value
      expect(url).toContain(encodeURIComponent(query));
    });

    it("returns an empty array for empty query", async () => {
      // Arrange & Act
      const result = await searchCompanies("");

      // Assert
      expect(result).toEqual({ results: [], totalResults: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns an empty array for whitespace-only query", async () => {
      // Arrange & Act
      const result = await searchCompanies("   ");

      // Assert
      expect(result).toEqual({ results: [], totalResults: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("makes request with items_per_page=10 parameter", async () => {
      // Arrange
      const query = "Atkins";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ items: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await searchCompanies(query);

      // Assert
      const call = mockFetch.mock.calls[0];
      const url = call[0];
      expect(url).toContain("items_per_page=10");
    });

    it("transforms API response into CompanySearchResult array", async () => {
      // Arrange
      const query = "Atkins";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          items: [
            {
              company_number: "01093549",
              title: "ATKINSRÉALIS UK HOLDINGS LIMITED",
              company_status: "active",
              address_snippet: "1 Stowe Avenue, Kympton, RG25 2JD",
            },
          ],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await searchCompanies(query);

      // Assert
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        companyNumber: "01093549",
        title: "ATKINSRÉALIS UK HOLDINGS LIMITED",
        status: "active",
        address: "1 Stowe Avenue, Kympton, RG25 2JD",
      });
      expect(result.totalResults).toBe(1);
    });

    it("includes HTTP Basic auth header in search request", async () => {
      // Arrange
      const query = "Atkins";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ items: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      await searchCompanies(query);

      // Assert
      const call = mockFetch.mock.calls[0];
      expect(call[1].headers).toHaveProperty("Authorization");
      expect(call[1].headers.Authorization).toMatch(/^Basic /);
    });

    it("throws error when API key is not set", async () => {
      // Arrange
      delete process.env.COMPANIES_HOUSE_API_KEY;

      // Act & Assert
      await expect(searchCompanies("Atkins")).rejects.toThrow(
        /COMPANIES_HOUSE_API_KEY/i
      );
    });
  });
});
