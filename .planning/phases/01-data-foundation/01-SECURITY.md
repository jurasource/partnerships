---
phase: 01
slug: data-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-14
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → Server Actions (create/update/delete) | Untrusted form input crosses into server-side DB write via Next.js Server Actions | Firm/topic names, Companies House number, capability tags, entity IDs |
| app → SQLite file (./data/app.db) | Local file write; path is env-configurable via `DATABASE_PATH` | All application data |
| app → Companies House API | Outbound HTTP to `api.company-information.service.gov.uk`; API key carried in Basic Auth header | API key (secret), company search queries, CH numbers |
| app → Contracts Finder / Find a Tender APIs | Outbound fetches to fixed GOV.UK procurement hosts; no key required | Search queries, OCDS JSON payloads |
| external API JSON → OCDS adapter | Untrusted third-party JSON parsed and normalised into the SQLite cache | OCDS procurement records, supplier names, contract values |
| browser → refreshFirm / CH-search server actions | User-triggered server-side outbound fetch (SSRF surface) | Firm ID, CH number, search query string |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | `createFirm` server action | mitigate | Zod validates all input (canonicalName non-empty, capabilityTags ∈ CapabilityTag union); Drizzle uses parameterised queries — no raw SQL string concatenation | closed |
| T-01-02 | Information Disclosure | `COMPANIES_HOUSE_API_KEY` (.env) | mitigate | Key only in `.env.local` (git-ignored via `.gitignore`); `.env.example` carries no real value; `data/` gitignored | closed |
| T-01-03 | Tampering | `DATABASE_PATH` file write | accept | Single-user local-first tool; path is developer-controlled env var, not user-supplied at runtime — no untrusted file-write surface. See Accepted Risks Log. | closed |
| T-01-04 | Tampering | `seed.ts` JSON / aliases parsing | mitigate | Seed data is developer-authored, not untrusted input; JSON columns parsed only from app-written rows; no third-party JSON parsed in this plan (prevents prototype pollution) | closed |
| T-01-SC | Tampering | npm / shadcn supply chain installs | mitigate | Task 1 blocking-human legitimacy gate before any install; packages verified on npmjs.com by user before execution | closed |
| T-01-05 | Tampering | `updateFirm` / `deleteFirm` / topic server actions | mitigate | Zod-validates all inputs; Drizzle `eq(table.id, id)` parameterised queries used throughout — no raw SQL interpolation | closed |
| T-01-06 | Elevation of Privilege | delete server actions | accept | Single-user local tool, no auth model (multi-user out of scope); destructive actions gated behind `AlertDialog` confirmation in UI. See Accepted Risks Log. | closed |
| T-01-07 | Spoofing | Server Action invocation | accept | Local-first single-user; Next.js Server Actions are same-origin POST with built-in action-id CSRF protection; no additional CSRF surface at this scale. See Accepted Risks Log. | closed |
| T-01-08 | Information Disclosure | `COMPANIES_HOUSE_API_KEY` (server-only client) | mitigate | Key read only in `http.ts` / `companies-house.ts` (marked `server-only`); CH search and refresh invoked via server actions — key never imported into a client component or logged | closed |
| T-01-09 | Server-Side Request Forgery | `refreshFirm` / CF / FTS / CH fetch clients | mitigate | Client base URLs are hard-coded constants to fixed GOV.UK hosts; only CH number and search query are user-supplied and URL-encoded into fixed paths; FTS `links.next` cursor is host-guarded to `find-tender.service.gov.uk` | closed |
| T-01-10 | Tampering | OCDS adapter — third-party JSON parsing | mitigate | API responses Zod-validated; only known fields pulled into typed columns (no `Object.assign`/spread of untrusted keys onto prototypes); empty/implausible fields tolerated without trust | closed |
| T-01-11 | Denial of Service | Rate limits / runaway fetch (`rateLimitedFetch`) | mitigate | `rateLimitedFetch` enforces concurrency cap + 429/5xx backoff with retry cap; cache-first means no re-fetch without explicit manual refresh | closed |
| T-01-12 | Repudiation | Data provenance | mitigate | Every procurement record stores `sourceApi` + full `rawJson` (D-10) so every cached fact is auditable back to its source payload | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-03 | `DATABASE_PATH` is a developer-controlled env var set at deploy time, not a user-supplied runtime value. No untrusted path can reach the file write. Local-first single-user tool makes this a non-exploitable surface. | developer (plan-time) | 2026-06-14 |
| AR-01-02 | T-01-06 | Application is a single-user local tool. Multi-user auth is explicitly out of scope (REQUIREMENTS). Destructive delete actions are gated behind AlertDialog confirmation to prevent accidental data loss. No privilege boundary to elevate across. | developer (plan-time) | 2026-06-14 |
| AR-01-03 | T-01-07 | Next.js Server Actions enforce same-origin POST with an opaque action ID header; no additional CSRF mitigation is warranted for a single-user local tool. | developer (plan-time) | 2026-06-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-14 | 13 | 13 | 0 | gsd-secure-phase orchestrator (short-circuit: all plan-time threats verified CLOSED in SUMMARY files) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-14
