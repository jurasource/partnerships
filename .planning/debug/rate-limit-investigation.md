# Rate Limit Investigation: 30k TPM Breach (12-firm batch run)

**Error:** `This request would exceed your organization's rate limit of 30,000 input tokens per minute`  
**Context:** Batch research run across 12 firms  
**Branch:** `debug/rate-limit-investigation`

---

## Root Cause Analysis

### 1. Token volume per firm

Each research job fires **7 sequential `generateText` calls** — one per topic. Estimated input tokens per call:

| Component | Tokens (est.) |
|-----------|--------------|
| RESEARCH_SYSTEM_PROMPT | ~200 |
| Firm header + grounding (CH + procurement) | ~700 |
| 5 Tavily results × ~200 tokens each | ~1,000 |
| Topic instruction | ~100 |
| **Per-call total** | **~2,000** |

7 topics × ~2,000 = **~14,000 input tokens per firm** for research alone.

If `finishReason === "length"` triggers the retry path (worker.ts:105), that topic doubles to ~4,000 tokens for the retry call.

### 2. Concurrency multiplier

`WORKER_CONCURRENCY` defaults to `2` (worker-process.ts:28). The same constant drives **all three queues** (research, cross-cutting, ch-refresh) independently:

```
Research worker:       concurrency=2
Cross-cutting worker:  concurrency=2
CH-refresh worker:     concurrency=2
```

So at peak, up to **6 concurrent BullMQ slots** are active — though the dominant consumers are the research and cross-cutting workers.

### 3. The cascade pattern

When research completes for a firm, `executeResearchJob` immediately enqueues **both** cross-cutting and CH-refresh jobs with no delay (runner.ts:48-51). With 12 firms and concurrency=2 on both queues:

```
t=0:     Firm A research starts → 7 LLM calls in sequence
t=0:     Firm B research starts → 7 LLM calls in sequence
t=60s:   Firm A research done → immediately enqueues cross-cutting
t=60s:   Firm B research done → immediately enqueues cross-cutting
         Cross-cutting worker picks up A and B (concurrency=2)
         Meanwhile Firms C and D start research
         → 4 concurrent LLM consumers on the same model/key
```

### 4. Cross-cutting LLM calls per firm

| Extractor | Calls | Notes |
|-----------|-------|-------|
| `extractRiskFlags` | up to 3 | financial, regulatory, reputation findings |
| `detectCoSuppliers` | 0 | SQL only |
| `extractConflicts` | up to 2 | partnerships, reputation findings |
| `extractCollaboration` | 2 | culture-fit pass + JV pairs pass |
| **Total** | **up to 7** | smaller prompts (~400-600 tokens each) |

Research + cross-cutting combined: **~14,000 + ~3,500 = ~17,500 tokens per firm**

### 5. Why 30k/min is breached

With 2 concurrent research jobs, both mid-stream on topics 4-7:
- 2 firms × ~2,000 tokens/call × rapid sequential calls = easily **4,000-6,000 tokens per minute just from research**
- But topics complete in seconds (API response ~5-10s), so within a single minute you can burn through 6-8 topic calls across 2 firms → **12,000-16,000 tokens**
- Add 2 cross-cutting jobs also active (the previous batch of firms): **+6,000-8,000 tokens**
- **Total burst: 18,000–24,000 tokens/min at moderate load; spikes to 30k+ when all queue slots fill simultaneously**

### 6. Retry amplification

`maxRetries: 2` in every `generateText` call means a rate-limited request is retried 2× more. The AI SDK uses exponential backoff, but the retry window (seconds) is much shorter than the rate limit window (60 seconds), so retries also exceed the limit. The error message "Failed after 3 attempts" confirms all 3 attempts hit the rate cap.

---

## Mitigation Options

### A. Reduce WORKER_CONCURRENCY to 1 (immediate, no code change)

Set `WORKER_CONCURRENCY=1` in your environment. Single research job active at a time → max ~2,000 tokens/call, sequential, with natural gaps from model response latency (~5-10s per call). 7 topics × 10s = 70s per firm, well within any per-minute limit.

**Pro:** Zero code change, effective immediately.  
**Con:** 12 firms becomes purely sequential (~14 minutes vs ~7 minutes at concurrency=2). Still the right default at this tier.

### B. BullMQ rate limiter on the research queue

Add a `limiter` to the research queue/worker so BullMQ enforces a maximum job-start rate:

```ts
// worker-process.ts
const worker = new Worker<ResearchJobPayload>(
  RESEARCH_QUEUE_NAME,
  async (job) => { ... },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 1,        // max 1 job active per...
      duration: 70000, // ...70 seconds
    },
  },
);
```

**Pro:** Declarative, survives restarts, doesn't require changing concurrency.  
**Con:** Doesn't account for cross-cutting jobs running in parallel on the same API key.

### C. Stagger batch job submission

In `runBatchJobs`, add a `delay` (ms) to each queued job beyond the first:

```ts
await researchQueue.add("research", { firmId, jobId }, {
  delay: index * 90_000, // 90s apart
});
```

**Pro:** Jobs spread across time, predictable throughput.  
**Con:** 12 firms × 90s = 18 minutes for all to start. Requires code change.

### D. Add inter-topic sleep in the research worker

After each `generateText` call, sleep `N` ms to stay within the per-minute token budget:

```ts
// After db.insert(findings)...
await new Promise(r => setTimeout(r, 5000)); // 5s between topics
```

7 topics × 5s = 35s per firm minimum. Rough throughput budget: 30,000 tokens/min ÷ 2,000 tokens/call = 15 safe calls/min. With concurrency=2, you have 7.5 calls/firm/min available → a sleep of ~8s keeps you safely under.

**Pro:** Fine-grained control.  
**Con:** Adds fixed latency per firm regardless of actual API load. Fragile if prompts grow.

### E. Implement Anthropic prompt caching

The `RESEARCH_SYSTEM_PROMPT` (~200 tokens) and grounding context (~700 tokens) are **identical across all 7 topic calls for a given firm**. Using Anthropic's prompt caching beta would cache these across the 7 calls, reducing input tokens by ~45% per call.

Estimated saving: 900 tokens × 7 calls = **6,300 tokens per firm saved from cache**.

```ts
// In worker.ts, add providerOptions for cached blocks
model: anthropic("claude-sonnet-4-6"),
providerOptions: {
  anthropic: {
    cacheControl: { type: "ephemeral" }, // on system + grounding block
  },
},
```

**Pro:** Reduces total token consumption permanently, cheaper cost too.  
**Con:** Requires restructuring the prompt to use `messages` with cache-control blocks (not just `system`/`prompt` strings). More code change.

### F. Trim Tavily results

`TavilySearchClient.search` requests `max_results=5` and passes the full `content` field (which can be 500-1000 chars per result). Reducing to 3 results and truncating snippets to 300 chars cuts search-result tokens from ~1,000 to ~300 per call.

**Pro:** Quick change, reduces token cost per call by ~35%.  
**Con:** May reduce research quality if key information is in result 4-5.

---

## Recommended Plan

**Immediate (today, no code):**
1. Set `WORKER_CONCURRENCY=1` in your environment before any further batch runs.

**Short-term (this branch, code changes):**
2. **Option C** — stagger batch job enqueue with a per-firm delay. This is the most robust because it keeps the queue honest even if concurrency is raised later.
3. **Option F** — trim Tavily to 3 results, cap snippets at 400 chars. Simple, reduces pressure.

**Medium-term:**
4. **Option E** — implement Anthropic prompt caching for the research worker's system prompt + grounding context. Biggest token reduction, also cuts cost.
5. Log `inputTokens` per job to the DB job row so future runs are visible in the `/jobs` UI.

---

## Questions for Discussion

- Did the error hit during research, cross-cutting, or both? (The stack trace + `[research]` vs `[cross-cutting]` logs would tell us.)
- What `WORKER_CONCURRENCY` was set to during the failing run?
- Were all 12 firms submitted simultaneously as a batch, or added over time?
- Are you on the free Anthropic tier (30k TPM is tier 1)? Purchasing credits moves you to tier 2 (60k TPM) — a quick unblock while code changes are made.
