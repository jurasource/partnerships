/**
 * Web search client interface — provider-agnostic (D-02).
 *
 * This is a PURE type file: no "server-only" import, no runtime code.
 * Import from both server-side clients (tavily.ts) and type-only imports
 * in schemas/workers that need the interface for DI.
 */

export type WebSearchQuery = {
  query: string;
  /** Max results to return (default 5). */
  maxResults?: number;
};

export type WebSearchResult = {
  url: string;
  title: string;
  snippet: string;
  /** ISO date string when the source was published, if available from the provider */
  publishedDate?: string | null;
};

export interface WebSearchClient {
  search(query: string, maxResults?: number): Promise<WebSearchResult[]>;
}
