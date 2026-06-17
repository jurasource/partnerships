---
slug: firm-id-fix-and-prompt-modal
status: complete
completed: 2026-06-17
---

# Summary

## What was done

1. **`src/lib/queries/consortium-prompt-data.ts`**: After the initial parallel DB fetch, collect all firm IDs referenced in partnership/conflict rows that fall outside the selected `firmIds` group, query their canonical names, and add them to `firmNameById`. Fixes the bug where cross-group conflicts showed raw UUIDs like `9a4e9138-...` instead of firm names.

2. **`src/components/consortium/prompt-builder.tsx`**: Added `PromptMarkdown` component (renders `##`/`###` headings, `-` bullet lists, and paragraphs). Added `promptModalOpen` state. Generate button now auto-opens a Dialog modal showing the rendered prompt. Modal footer has a "Copy raw markdown" button. Main area shows "View Prompt" + "Run with Claude" buttons once a prompt exists (removed the editable textarea).

## Tests

All 17 existing unit tests in `assemble-prompt.test.ts` pass. No new TS errors in changed files.
