---
slug: baringa-uk-incorporated-missing
status: resolved
trigger: "Baringa Partners LLP (CH OC303471) shows nothing for UK INCORPORATED in the UI but should. Nichols Group does show it."
created: 2026-06-15
updated: 2026-06-15
---

## Symptoms

- expected: "UK INCORPORATED" label/badge/flag shows for Baringa Partners LLP (CH number OC303471) in the UI
- actual: Nothing shows for UK INCORPORATED for Baringa, even after re-running jobs
- errors: None reported
- timeline: Ongoing; jobs have been re-run but problem persists
- reproduction: View Baringa Partners LLP firm profile/card in the dashboard UI
- contrast: "Nichols Group" correctly shows UK INCORPORATED — so the feature works for some firms but not this one
- note: Baringa Partners LLP is an LLP (CH number starts with OC, not a standard Ltd). Nichols Group may be a standard Ltd company.

## Current Focus

reasoning_checkpoint:
  hypothesis: "extractOwnership derives ukIncorporated solely from the CH PSC register and only enters the CH branch when psc.items.length > 0. Baringa is an LLP with an EMPTY PSC register (active_count 0, items []), so the code skips the authoritative CH profile.jurisdiction='england-wales' signal and falls through to the AI-research fallback, which hardcodes ukIncorporated='unknown'. Nichols (Ltd) has 2 UK PSC items so gets 'yes'."
  confirming_evidence:
    - "DB: Baringa ownership_records.ukIncorporated='unknown', sourceType='ai_research' (fell through to fallback)"
    - "DB: Nichols ownership_records.ukIncorporated='yes', sourceType='companies_house'"
    - "CH API: Baringa OC303471 profile.type='llp', profile.jurisdiction='england-wales', PSC active_count=0 items=[]"
    - "CH API: Nichols 12852280 profile.jurisdiction='england-wales', PSC has 2 UK individual PSCs"
    - "ownership.ts:173 guard `if (chNumber && psc?.items && psc.items.length > 0)` is FALSE for Baringa → CH branch skipped entirely"
  falsification_test: "If ukIncorporated were derived from profile.jurisdiction, an LLP with empty PSC but england-wales jurisdiction would be 'yes'. It is 'unknown' → confirms jurisdiction is ignored."
  fix_rationale: "Use CH profile.jurisdiction as the authoritative incorporation signal. A UK jurisdiction means the firm IS UK-incorporated regardless of PSC contents. PSC data should drive ownership/control fields (countryOfOwnership, pscNotTraceable, ultimateParent), NOT the incorporation flag. Add a CH-profile branch that runs when we have a profile with a UK jurisdiction even if PSC is empty."
  blind_spots: "Firms with non-UK jurisdiction values; jurisdiction values other than england-wales (scotland, northern-ireland); profile fetch failing while PSC succeeds (rare). Need to enumerate UK jurisdiction tokens CH actually returns."

## Evidence

- checked: "extractOwnership logic in src/lib/cross-cutting/ownership.ts"
  found: "ukIncorporated is computed ONLY inside the `psc?.items.length > 0` branch (line 173-188) from PSC nationality/jurisdiction. The CH company profile is fetched (line 157) but profile.jurisdiction is NEVER used to determine ukIncorporated."
  implication: "Any firm with an empty PSC register is routed to the AI fallback and marked 'unknown' regardless of actual incorporation."

- checked: "Live CH API + DB for Baringa (OC303471) and Nichols (12852280)"
  found: "Baringa: type=llp, jurisdiction=england-wales, PSC active_count=0 items=[] → DB ukIncorporated='unknown' sourceType='ai_research'. Nichols: type=ltd, jurisdiction=england-wales, 2 UK PSC individuals → DB ukIncorporated='yes' sourceType='companies_house'."
  implication: "Confirmed: empty PSC (typical for LLPs) bypasses CH branch; jurisdiction=england-wales (clearly UK) is ignored. Root cause confirmed."

## Eliminated

- hypothesis: "PSC classification mis-handles LLP member nationality/kind values"
  evidence: "Baringa's PSC register is entirely empty (0 items) — there are no items to classify. The bug is upstream: the empty-PSC case never reaches classification."

## Resolution

root_cause: "extractOwnership in src/lib/cross-cutting/ownership.ts determines ukIncorporated exclusively from the Companies House PSC register, and only when psc.items.length > 0. The CH company profile's `jurisdiction` field — the authoritative incorporation signal — is fetched but never used. Baringa Partners LLP (OC303471) has an empty PSC register (active_count 0), which is normal for LLPs, so the CH branch is skipped and the firm falls through to the AI-research fallback that hardcodes ukIncorporated='unknown'. Nichols Group (Ltd) has UK PSC entries and is correctly marked 'yes'."
fix: "In src/lib/cross-cutting/ownership.ts: (1) added UK_JURISDICTION_TERMS + isUkJurisdiction() helper; (2) in the PSC branch, ukIncorporated is now derived authoritatively from profile.jurisdiction (falling back to PSC-nationality only when jurisdiction is absent/unrecognised), correctly separating incorporation from ownership/control; (3) added a new branch that, when a CH profile exists with a determinable jurisdiction but the PSC register is empty (the LLP case), writes a companies_house-sourced ownership record using the jurisdiction instead of falling through to the 'unknown' AI fallback. Updated ownership.test.ts: foreign-corporate-PSC test now expects ukIncorporated 'yes' for a UK-registered firm (foreign ownership surfaces via pscNotTraceable + countryOfOwnership); added a non-UK-jurisdiction test and an empty-PSC LLP regression test. Re-ran extractOwnership for Baringa to correct its live DB row."
verification: "Live DB after fix: Baringa OC303471 → ukIncorporated 'yes', sourceType 'companies_house', countryOfOwnership 'UK', snippet cites england-wales jurisdiction + empty PSC. Nichols unchanged ('yes', companies_house). Full suite green: 155 tests / 18 files pass, including 8 ownership tests (3 new)."
files_changed:
  - "src/lib/cross-cutting/ownership.ts"
  - "src/lib/cross-cutting/__tests__/ownership.test.ts"
