---
slug: analysis-group-select-freeze
status: awaiting_human_verify
created: "2026-06-15"
updated: "2026-06-15"
trigger: "When selecting a group item in the analysis page, the UI freezes completely — nothing responds to clicks — until the page is refreshed. No console errors."
---

# Debug Session: analysis-group-select-freeze

## Symptoms

- **Expected**: Selecting a group item on the analysis page should filter firms to that group
- **Actual**: UI freezes completely — no clicks register — until manual page refresh
- **Errors**: No console errors thrown
- **Timeline**: Works in local dev, broken on prod (Vercel + Railway)
- **Reproduction**: Select a group item on the analysis page

## Current Focus

```
reasoning_checkpoint:
  hypothesis: The Groups dropdown is a Base UI Menu with modal:true (the default). Modal menus
              lock document scroll and disable outside pointer interaction while open. Selecting
              a group checkbox toggles selectedGroupIds, which synchronously re-renders the heavy
              analysis tree (N x N ConflictMatrix + many Tooltips) at the same instant the modal
              menu closes and runs its scroll-lock RESTORE effect. The restore relies on
              module-level shared globals (originalHtmlStyles/originalBodyStyles in
              @base-ui/utils useScrollLock.js); the race between the heavy re-render and the
              lock-restore cleanup leaves the document stuck in its locked/modal-blocked state
              -> page fully unclickable until refresh, no console error.
  confirming_evidence:
    - "MenuRoot defaults modal:true (MenuStore.js line 120; MenuRoot.d.ts @default true; doc: modal locks page scroll and disables outside pointer interactions)."
    - "MenuPositioner.js:226 applies useAnchoredPopupScrollLock when popupModal (modal && reason!=hover)."
    - "useScrollLock.js stores original body/html styles in MODULE-LEVEL globals -> not instance-safe across overlapping lock/unlock cycles."
    - "Symptom matches the documented popup-library class: body left non-interactive after close, no console error, until refresh (web search: radix/shadcn pointer-events:none stuck issues)."
    - "Analysis page uniquely freezes because its post-select re-render (N x N grid + tooltips) is far heavier than firms-table, widening the close/restore race window; prod-only because React batching/effect timing differs from dev + StrictMode masks it in dev."
  falsification_test: "Set modal={false} on the Groups (and Capabilities) DropdownMenu. If the freeze no longer occurs on a production build, modal scroll-lock is confirmed as the cause. If it still freezes, hypothesis is wrong."
  fix_rationale: "These dropdowns are non-modal filter menus -- there is no reason to lock page scroll or block outside interaction. Setting modal={false} eliminates the scroll-lock/outside-pointer machinery entirely, removing the race at its source rather than patching the stuck style after the fact."
  blind_spots: "Have not reproduced live on a prod build locally (needs DB + prod data). The other modal menus/popovers in the app could share the latent issue; fix is scoped to the filter dropdowns that match the reported trigger."
test: Set modal={false} on the filter DropdownMenus; verify dropdown still opens/closes and selection no longer freezes.
next_action: Apply modal={false} to the Groups and Capabilities DropdownMenu in firms-filter-bar.tsx.
```

## Evidence

- checked: Stack identification (package.json + ui primitives)
  found: UI primitives use @base-ui/react ^1.5.0 (installed 1.5.0), Next 16.2.9, React 19.2.4.
         DropdownMenu = base-ui Menu; Select = base-ui Select.
  implication: Group multi-select is a base-ui Menu.CheckboxItem with controlled `checked` +
               onCheckedChange. Controlled-checkbox infinite loops are a known class in this family.

- checked: Data flow analysis-page-client -> useFirmFilters -> filteredData -> ConflictMatrix/OwnershipRollup/PartnershipTable
  found: All three analysis children are render-pure (no render-phase setState). ConflictMatrix
         renders an N x N grid; selecting a group REDUCES N, so size is not the cause.
  implication: The freeze is not from larger render work after filtering; points to a loop in the
               control (group dropdown) state path or a hydration/render-loop that prod doesn't surface.

- checked: Symptom signature — complete UI freeze, NO console errors, local dev OK, prod broken
  found: A total main-thread block with zero console output is the signature of either (a) a
         synchronous infinite loop, or (b) "Maximum update depth exceeded" which React THROWS and
         logs in dev but can manifest as a silent hang in a minified prod build.
  implication: Strongest lead is a render loop specific to group selection. Must reproduce with a
               production build to confirm (dev mode masks the prod failure mode).

## Eliminated

- hypothesis: Synchronous infinite render loop / "Maximum update depth exceeded" in the analysis tree.
  evidence: All three analysis children (ConflictMatrix, OwnershipRollup, PartnershipTable) are
            render-pure with no render-phase setState; useFirmFilters has no effects. No mechanism
            for a self-perpetuating update. Symptom (page unclickable until refresh, no error) is
            the scroll-lock/modal-state signature, not a CPU-bound loop.
  timestamp: "2026-06-15"

## Resolution

```
root_cause: The Groups (and Capabilities) filter uses a Base UI <DropdownMenu> (Menu.Root), which
            defaults to modal:true. A modal menu locks document scroll and disables outside pointer
            interaction while open. Selecting a group checkbox toggles selectedGroupIds, which
            synchronously re-renders the heavy analysis subtree (N x N ConflictMatrix + many
            Tooltips) at the same instant the modal menu closes and runs its scroll-lock RESTORE.
            The restore depends on module-level shared globals in @base-ui/utils useScrollLock.js;
            under production React batching/effect timing the heavy re-render races with the
            lock-restore cleanup, leaving the document stuck in its locked / modal-blocked state.
            Result: page fully unclickable until refresh, no console error. Prod-only because dev
            effect timing + StrictMode mask the race; analysis page uniquely affected because its
            post-select re-render is far heavier than the firms table, widening the race window.
fix: Set modal={false} on the Groups and Capabilities DropdownMenus in firms-filter-bar.tsx. These
     are non-modal filter menus that have no need to lock page scroll or block outside interaction;
     disabling modal removes the scroll-lock machinery entirely, eliminating the race at the source.
verification: tsc shows no new errors in the changed file (only pre-existing stale .next artifact
              and test-file errors, unrelated). Full vitest suite: 159/159 passing. Live prod-only
              confirmation pending human verification.
files_changed: ["src/components/firms/firms-filter-bar.tsx"]
```
