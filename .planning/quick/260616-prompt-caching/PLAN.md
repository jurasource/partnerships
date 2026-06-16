# Plan: Anthropic Prompt Caching for Research Worker

**Goal:** Reduce input token consumption per firm by ~40–50% by caching the system
prompt and grounding context across the 7 sequential topic calls.

**Context:** Each research job sends the same system prompt (~200 tokens) and
grounding context (~700 tokens) in every one of its 7 `generateText` calls. That's
~6,300 tokens of repeated data per firm. With Anthropic's prompt caching, this prefix
is stored server-side for 5 minutes and charged at 10% cost on cache hits.

---

## Background: How Anthropic Prompt Caching Works

- A `cache_control: { type: "ephemeral" }` marker is placed at the end of a content
  block to indicate "cache everything up to and including this block."
- The cache block must be ≥1024 tokens (Sonnet 4.x minimum). Smaller blocks are
  silently not cached and charged at normal rate.
- Cache TTL is 5 minutes. All 7 topic calls for one firm complete in ~70s, so they
  will always hit the same cache entry.
- Cache write is charged at 125% of normal token cost (once per firm). Cache reads
  are charged at 10%. Net saving starts from the second topic call.
- Requires the `@ai-sdk/anthropic` provider — already in use.

## AI SDK Integration

The current code passes `system` and `prompt` as plain strings to `generateText`.
Cache control requires switching the user turn to a `messages` array with
`providerOptions` on the cacheable content block:

```ts
// Current (no caching):
generateText({
  model: anthropic("claude-sonnet-4-6"),
  system: RESEARCH_SYSTEM_PROMPT,
  prompt: buildTopicPrompt(topic, groundingContext, searchResults),
  ...
})

// Target (with caching on grounding prefix):
generateText({
  model: anthropic("claude-sonnet-4-6"),
  system: RESEARCH_SYSTEM_PROMPT,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildGroundingBlock(groundingContext),  // stable prefix
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
        {
          type: "text",
          text: buildTopicBlock(topic, searchResults),  // changes per topic
        },
      ],
    },
  ],
  ...
})
```

---

## Token Size Check (prerequisite)

**Before implementing,** verify that the grounding block alone reaches 1024 tokens.
From existing logs, `tokens in=` is printed per call. The grounding block is roughly:
- RESEARCH_SYSTEM_PROMPT: ~200 tokens
- Firm header + CH profile: ~200–400 tokens
- Procurement records (top 10): ~400–700 tokens
- Combined prefix: **~800–1,300 tokens**

If the prefix is consistently below 1024 tokens, the `system` prompt must be enlarged
(e.g., add the full output schema description or evaluation rubric) to push it over the
threshold. Do not pad with meaningless content — expand with genuinely useful rules.

**Action:** Add a `console.log` to the worker before the first topic call that prints
`groundingBlock.length` in chars. A rough rule: ~4 chars ≈ 1 token. Target ≥4096 chars
for the cacheable block to reliably exceed 1024 tokens.

---

## Tasks

### Task 1 — Refactor prompt builders

**File:** `src/lib/research/prompts.ts`

Split `buildTopicPrompt` into two functions:
- `buildGroundingBlock(ctx: GroundingContext): string` — returns the stable prefix
  (system context, firm header, CH data, procurement records). This becomes the cached block.
- `buildTopicBlock(topic: Topic, searchResults: WebSearchResult[]): string` — returns
  the per-topic instruction and search results. This follows the cache breakpoint.

The existing `buildTopicPrompt` can remain as a convenience wrapper (used in tests) that
joins both outputs.

### Task 2 — Add cache control to generateText calls

**File:** `src/lib/research/worker.ts`

Pre-compute `buildGroundingBlock(groundingContext)` once before the topic loop (it's
stable across all 7 calls for a given firm). In the loop, switch from `prompt:` to
`messages:` array as shown above.

Apply the same change to the `finishReason === "length"` retry call on line ~109.

The `output: Output.object({ schema: FindingSchema })` option is unchanged — it works
with the `messages` format.

### Task 3 — Log cache token usage

**File:** `src/lib/research/worker.ts`

The Anthropic provider exposes cache stats via `result.providerMetadata`:

```ts
const meta = result.providerMetadata?.anthropic as {
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
} | undefined;

console.log(
  `[research] cache: created=${meta?.cacheCreationInputTokens ?? 0} ` +
  `read=${meta?.cacheReadInputTokens ?? 0}`,
);
```

Log this after each `generateText` call so we can confirm caching is working.

### Task 4 — Verify minimum token threshold

Run a single-firm research job and check logs for `cache read=` on topics 2–7. If
`cacheReadInputTokens` is 0 on all calls, the block is below 1024 tokens — expand the
grounding block (see Token Size Check above).

### Task 5 — Apply same pattern to cross-cutting extractors (optional, lower priority)

`extractRiskFlags`, `extractConflicts`, and `extractCollaboration` each make 2–3 small
LLM calls with short prompts (~400–600 tokens). These are below the caching minimum and
not worth caching unless the prompts are significantly enlarged. Skip for now.

---

## Expected Outcome

| Scenario | Input tokens per firm (research) |
|----------|----------------------------------|
| Before   | 7 × ~2,000 = ~14,000 |
| After (cache hits topics 2–7) | 1 × ~2,000 (write) + 6 × ~900 (read) = ~7,400 |
| Saving   | ~47% reduction in billable input tokens |

This also directly reduces the sustained TPM rate, providing additional headroom against
the 30k/min limit on top of the stagger fix.

---

## Dependencies / Risks

- `Output.object` structured output must still work with the `messages` format — verify
  in a unit test before shipping (the worker test at `src/lib/research/worker.test.ts`
  mocks `generateText` so add an integration-style check for the message shape).
- If `providerOptions` is not yet available in the installed AI SDK version, check
  `experimental_providerMetadata` as the fallback key (older AI SDK versions used this).
- The 5-minute cache TTL is not a risk here — all 7 topic calls complete well within 5
  minutes for a single firm.
