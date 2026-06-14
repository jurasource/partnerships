---
created: 2026-06-14T17:03:58.403Z
title: Consortium analysis firm selection and named groups
area: ui
files:
  - src/app/consortium/
  - src/db/schema.ts
---

## Problem

The consortium analysis currently operates on a fixed set of firms. Users need to:
1. Select all firms or a specific subset before running an analysis.
2. Save a named group of firms for repeated future analyses and comparisons (e.g. "Nuclear Tier 1", "Shortlist Q3 2026").
3. A firm can belong to multiple groups.

## Solution

1. **Firm selection UI**: Add a multi-select step before running consortium analysis. Options: "All firms" or a custom subset chosen via checkboxes in a searchable list.
2. **Named groups**: Add a `firmGroups` table (`id`, `name`, `description`, `createdAt`) and a `firmGroupMembers` join table (`groupId`, `firmId`). Enforce unique group names.
3. **Group management UI**: Simple CRUD panel (create/rename/delete group, add/remove firms). Accessible from the dashboard or a dedicated `/groups` page.
4. **Analysis integration**: When launching consortium analysis, allow the user to pick an existing group or the current ad-hoc selection. Store which group/selection was used in the analysis run record for auditability.
