import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * isSafeUrl — returns true only for http: and https: URLs.
 *
 * Prevents javascript: or other dangerous URI schemes from being rendered
 * as href attributes in anchor tags. Use this before rendering any
 * user-sourced or DB-sourced URL as an href.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * parseCapabilityTags — safely parses a JSON capability tags string from the DB.
 *
 * Falls back to [] on invalid JSON, logging a warning in development so data
 * corruption upstream is visible rather than silently suppressed.
 */
export function parseCapabilityTags(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[parseCapabilityTags] Failed to parse capability tags JSON:", raw);
    }
    return [];
  }
}
