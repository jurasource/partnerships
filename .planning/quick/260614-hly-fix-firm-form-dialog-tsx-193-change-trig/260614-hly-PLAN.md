---
phase: quick
plan: 260614-hly
type: execute
wave: 1
depends_on: []
files_modified: [src/components/firms/firm-form-dialog.tsx]
autonomous: true
requirements: [BUILD-FIX]
must_haves:
  truths:
    - "npm run build completes without the trigger-prop type error"
    - "DialogTrigger.render receives a value matching its expected type"
  artifacts:
    - path: "src/components/firms/firm-form-dialog.tsx"
      provides: "FirmFormDialogProps with correctly typed trigger prop"
      contains: "trigger?: React.ReactElement"
  key_links:
    - from: "src/components/firms/firm-form-dialog.tsx"
      to: "DialogTrigger render prop"
      via: "trigger ?? defaultTrigger"
      pattern: "DialogTrigger render=\\{trigger \\?\\? defaultTrigger\\}"
---

<objective>
Fix the failing production build caused by a type mismatch on the `trigger` prop of `FirmFormDialog`.

Purpose: `src/components/ui/dialog.tsx`'s `DialogTrigger.render` (shadcn Base UI) only accepts `ReactElement | ComponentRenderFn | undefined`, but `FirmFormDialogProps.trigger` is declared as the wider `React.ReactNode`. Passing `trigger ?? defaultTrigger` into `render` therefore fails type-check and breaks `npm run build`.

Output: A single-line type annotation change narrowing `trigger` from `React.ReactNode` to `React.ReactElement`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/components/firms/firm-form-dialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Narrow trigger prop type to React.ReactElement</name>
  <files>src/components/firms/firm-form-dialog.tsx</files>
  <action>In the `FirmFormDialogProps` type (lines 49-54), change the `trigger` prop annotation on line 53 from `trigger?: React.ReactNode;` to `trigger?: React.ReactElement;`. This aligns the prop with `DialogTrigger.render`'s accepted type (`ReactElement | ComponentRenderFn | undefined`). The `render={trigger ?? defaultTrigger}` usage on line 193 already supplies a `ReactElement` (a `<Button>`) as the fallback, so no further change is needed. Update the inline JSDoc comment on line 52 only if it references the type; otherwise leave it. Do not change any other prop or behavior.</action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>`npm run build` completes without the `DialogTrigger` / `trigger` type error, and `grep -n "trigger?: React.ReactElement" src/components/firms/firm-form-dialog.tsx` returns the line.</done>
</task>

</tasks>

<verification>
- `npm run build` succeeds (or at minimum no longer reports the `trigger` / `DialogTrigger.render` type error).
- `npx tsc --noEmit` reports no error on `firm-form-dialog.tsx` line 193.
</verification>

<success_criteria>
- `FirmFormDialogProps.trigger` is typed `React.ReactElement`.
- The production build no longer fails on the trigger-prop type mismatch.
- No behavioral or styling changes to the dialog.
</success_criteria>

<output>
Create `.planning/quick/260614-hly-fix-firm-form-dialog-tsx-193-change-trig/260614-hly-SUMMARY.md` when done
</output>
