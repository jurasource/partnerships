---
slug: firm-add-wizard
created: "2026-06-15"
status: in-progress
---

# Firm Add/Edit Wizard

Redesign the Add/Edit Firm flow into a 2-step wizard with Companies House search-first UX.

## Goal

Replace the single-step `FirmFormDialog` with a proper 2-step wizard that leads with CH search, shows a company preview panel, validates CH numbers with ✓/✗ badges, and offers rich alias management with chip tags, CH refresh, and AI-generated suggestions.

## Tasks

- [x] 1. Extend CH client: `previous_company_names` + `total_results` in schemas
- [x] 2. Add `validateChNumberAction` server action; update `searchCompaniesAction` to return `total_results`
- [x] 3. Create `alias-actions.ts` with `generateAliasesAction` (Claude via AI SDK)
- [x] 4. Create `alias-chips.tsx` reusable chip component
- [x] 5. Rewrite `ch-search-field.tsx` as Step 1 panel (search → dropdown → preview → badge)
- [x] 6. Rewrite `firm-form-dialog.tsx` as 2-step wizard
- [x] 7. Add Edit Firm button to `firm-profile-page.tsx` header
- [x] 8. Run tests, fix failures, commit

## Spec

### Step 1 — CH Search
- Full-width search input (firm name or CH number)
- Explicit Search button (no auto-search)
- Results list; first result auto-selected
- Preview panel: registered name, CH number, type, status, incorporated date, address
- "Showing 10 of XXX results — type more to narrow" when total_results > items
- Raw CH number entry (8 chars) → debounce-validate → ✓ or ✗ badge
- "Next →" enabled once valid selection exists

### Step 2 — Firm Details
- Canonical name pre-filled from CH title (editable)
- Aliases as removable chip tags, pre-seeded from CH registered name + previous_company_names
- "Refresh from CH" button (explicit) — merges new CH suggestions into alias list
- "AI Suggest" button — calls generateAliasesAction, shows suggestions as accept/reject chips
- Capability tag toggles
- "← Back" / "Add Firm" or "Save Changes"

### Edit from firm profile page
- "Edit Firm" button in firm-profile-page.tsx header (right side, next to refresh buttons)
- In edit mode: Step 1 opens with existing CH number pre-validated → user can skip to Step 2

### Key invariants
- CH API key stays server-side only
- Edit mode starts on Step 1 with existing CH pre-populated and validated
- "Refresh from CH" visible in edit mode; also visible in add mode once on Step 2
- Aliases stored as JSON array (no schema migration)
- All server actions return `{ ok: true, ... } | { ok: false, error: string }`
