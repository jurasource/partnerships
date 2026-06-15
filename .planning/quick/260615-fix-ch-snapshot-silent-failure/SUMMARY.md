---
slug: fix-ch-snapshot-silent-failure
status: complete
---

# Fix CH Snapshot Silent Failure — Complete

Root cause confirmed and fixed. The outer try-catch in `extractOwnership` was catching DB errors (including missing-table) in addition to CH API failures, so `ch_snapshots` was never written and the job appeared to succeed. 

All three deliverables shipped in commit `c4b39e5`:
1. Fixed `fetchAndCacheCH` helper — DB errors propagate, API errors caught individually
2. "Refresh CH Data" button on every firm profile CH panel (inline server action, no queue)
3. 4 new snapshot write tests (159 total, all green)
