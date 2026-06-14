import { vi } from "vitest";

// Mock server-only package which is used to mark server-side code
vi.mock("server-only", () => ({}));
