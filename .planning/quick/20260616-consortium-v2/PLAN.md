---
slug: consortium-v2
created: 2026-06-16
---

# Consortium Page v2

Rename Recommend → Consortium, add firm group scoping, add AI Prompt Builder tab.

## Tasks

- [ ] T1: Create feature branch `feature/consortium-v2` from main
- [ ] T2: Rename route `/recommend` → `/consortium` (move files, update nav)
- [ ] T3: Add `poolFirmIds` to RecommendRequestSchema + API route filter
- [ ] T4: New query `groups-for-consortium.ts`
- [ ] T5: Add group selector to consortium page (RSC + client)
- [ ] T6: New query `consortium-prompt-data.ts`
- [ ] T7: New `assemblePrompt` pure function (testable)
- [ ] T8: New API route `/api/consortium-prompt`
- [ ] T9: New `PromptBuilder` wizard component
- [ ] T10: Wire tabs into `ConsortiumClient` (Recommender | AI Prompt Builder)
- [ ] T11: Unit test for `assemblePrompt`
- [ ] T12: Run full test suite, fix any failures
- [ ] T13: Update PENDING_RELEASE.md + RELEASE_NOTES.md
- [ ] T14: Commit
