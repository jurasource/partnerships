import "server-only";
import { z } from "zod";

import { rateLimitedFetch } from "../clients/http";
import type { WebSearchClient, WebSearchResult } from "./types";

/**
 * Tavily web-search client (server-side only — contains API key).
 *
 * Implements WebSearchClient for provider-agnostic usage (D-02).
 * API key is read from process.env and NEVER hardcoded or exposed to the client.
 * Only firm name / topic strings (not user-controlled host/scheme) reach fetch
 * — POSTs to the hard-coded TAVILY_BASE constant (SSRF mitigation).
 *
 * Responses are Zod-validated (.passthrough tolerant) and mapped to the
 * canonical WebSearchResult shape.
 */

const TAVILY_BASE = "https://api.tavily.com";

function getTavilyApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error(
      "TAVILY_API_KEY is not set — Tavily web search requires a free API key.",
    );
  }
  return key;
}

// Zod schema — defensive, .passthrough tolerant of undocumented fields
const TavilyResultItemSchema = z
  .object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    published_date: z.string().nullish(),
  })
  .passthrough();

const TavilyResponseSchema = z
  .object({
    results: z.array(TavilyResultItemSchema).default([]),
  })
  .passthrough();

class TavilySearchClient implements WebSearchClient {
  async search(query: string, maxResults = 5): Promise<WebSearchResult[]> {
    const apiKey = getTavilyApiKey();

    const res = await rateLimitedFetch(`${TAVILY_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily request failed (${res.status})`);
    }

    const raw = await res.json();
    const parsed = TavilyResponseSchema.parse(raw);

    return parsed.results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
      publishedDate: r.published_date ?? null,
    }));
  }
}

export const tavilyClient: WebSearchClient = new TavilySearchClient();
