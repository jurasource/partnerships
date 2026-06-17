---
slug: firm-id-fix-and-prompt-modal
created: 2026-06-17
status: complete
---

# Fix firm IDs in prompt + rendered prompt modal

## Tasks

1. Fix `consortium-prompt-data.ts` — after initial parallel fetch, collect extra firm IDs from partnership/conflict rows not in the selected group and fetch their canonical names. Add to `firmNameById` before building the firm contexts.

2. Update `prompt-builder.tsx`:
   - Add `PromptMarkdown` component (simple line-by-line renderer: `##` → h2, `###` → h3, `- ` → list, else paragraph)
   - Add Dialog modal that opens automatically on generate success
   - Copy button in modal footer copies raw markdown
   - Replace inline textarea section with "View Prompt" button + "Run with Claude" button row
