import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the action
vi.mock("@/db/client", () => ({ db: {}, sql: {} }));
vi.mock("@/lib/auth/hash", () => ({
  verifyCode: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  setSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { verifyAccessCode } from "./actions";
import { db } from "@/db/client";
import { verifyCode } from "@/lib/auth/hash";
import { setSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const mockDb = db as any;
const mockVerifyCode = vi.mocked(verifyCode);
const mockSetSession = vi.mocked(setSession);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedirect = redirect as unknown as ReturnType<typeof vi.fn>;

describe("verifyAccessCode server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: redirect throws NEXT_REDIRECT (Next.js behaviour)
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("Test 1: returns error for empty access code input", async () => {
    const formData = new FormData();
    formData.set("code", "");

    const result = await verifyAccessCode(formData);

    expect(result).toEqual({ error: "Access code is required." });
    expect(mockDb.select).not.toBeDefined();
  });

  it("Test 2: returns generic error when no active candidates in DB", async () => {
    const formData = new FormData();
    formData.set("code", "someCode");

    // Mock DB: no candidates returned
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    mockDb.select = mockSelect;

    const result = await verifyAccessCode(formData);

    expect(result).toEqual({ error: "Invalid access code. Please try again." });
    expect(mockVerifyCode).not.toHaveBeenCalled();
  });

  it("Test 3: calls setSession and redirect('/') when a matching active unexpired candidate is found", async () => {
    const formData = new FormData();
    formData.set("code", "validCode123");

    const mockCandidate = {
      id: "cand-1",
      codeHash: "salt:hash",
      active: true,
      expiresAt: null, // no expiry
      label: "Luke",
    };

    // Mock DB: returns one active candidate
    const mockWhere = vi.fn().mockResolvedValue([mockCandidate]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    // Also mock update for lastUsedAt (fire-and-forget)
    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    mockDb.select = mockSelect;
    mockDb.update = mockUpdate;

    // verifyCode returns true for the matching candidate
    mockVerifyCode.mockResolvedValue(true);
    mockSetSession.mockResolvedValue(undefined);

    await expect(verifyAccessCode(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(mockVerifyCode).toHaveBeenCalledWith("validCode123", "salt:hash");
    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("Test 4: returns error when candidate expiresAt is in the past", async () => {
    const formData = new FormData();
    formData.set("code", "expiredCode");

    const pastDate = new Date("2020-01-01T00:00:00Z");
    const mockCandidate = {
      id: "cand-2",
      codeHash: "salt:hash",
      active: true,
      expiresAt: pastDate,
      label: "Expired",
    };

    // Mock DB: returns the expired candidate
    const mockWhere = vi.fn().mockResolvedValue([mockCandidate]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    mockDb.select = mockSelect;

    // verifyCode returns true (code matches but is expired)
    mockVerifyCode.mockResolvedValue(true);

    const result = await verifyAccessCode(formData);

    expect(result).toEqual({ error: "Invalid access code. Please try again." });
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
