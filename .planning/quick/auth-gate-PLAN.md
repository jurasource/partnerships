---
plan: auth-gate
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/schema.ts
  - src/lib/auth/session.ts
  - src/lib/auth/hash.ts
  - src/scripts/generate-access-code.ts
  - src/app/login/page.tsx
  - src/app/login/actions.ts
  - src/app/login/actions.test.ts
  - src/middleware.ts
autonomous: true

must_haves:
  truths:
    - "All routes (except /login and static assets) redirect to /login when no valid session cookie is present"
    - "Entering a valid active access code on /login sets a signed HttpOnly session cookie and redirects to /"
    - "Entering an invalid code returns a generic error with no timing leak"
    - "The access_codes table stores only bcrypt/scrypt hashes — no plaintext codes in the DB"
    - "The generate-access-code script prints the plaintext code once and stores only its hash"
    - "An expired or inactive access code is rejected"
  artifacts:
    - path: "src/db/schema.ts"
      provides: "accessCodes table added to existing schema"
      contains: "accessCodes"
    - path: "src/lib/auth/session.ts"
      provides: "getSession(), setSession(), clearSession() using iron-session"
      exports: ["getSession", "setSession", "clearSession", "SessionData"]
    - path: "src/lib/auth/hash.ts"
      provides: "hashCode(plaintext), verifyCode(plaintext, hash) using crypto.scrypt"
      exports: ["hashCode", "verifyCode"]
    - path: "src/scripts/generate-access-code.ts"
      provides: "CLI script — generates random code, hashes it, inserts into DB, prints plaintext"
    - path: "src/app/login/page.tsx"
      provides: "Login page at /login with single access-code input"
    - path: "src/app/login/actions.ts"
      provides: "verifyAccessCode server action — checks hash, sets session, redirects"
    - path: "src/middleware.ts"
      provides: "Middleware guard — redirects unauthenticated requests to /login"
  key_links:
    - from: "src/middleware.ts"
      to: "src/lib/auth/session.ts"
      via: "getSession() to read cookie"
      pattern: "getSession"
    - from: "src/app/login/actions.ts"
      to: "src/lib/auth/hash.ts"
      via: "verifyCode(input, stored_hash)"
      pattern: "verifyCode"
    - from: "src/app/login/actions.ts"
      to: "src/lib/auth/session.ts"
      via: "setSession() on success"
      pattern: "setSession"
---

<objective>
Gate the entire site behind a single-factor access-code login. Any unauthenticated request is redirected to /login; entering a valid pre-generated code sets a signed HttpOnly session cookie and grants access. No plaintext codes are persisted — only scrypt hashes. A one-shot CLI script generates and registers codes.

This is appropriate for a single-operator internal tool. If role-based or multi-user access is needed later, migrate to Auth.js/Clerk.
</objective>

## Phase Goal (user story)

**As a** site operator, **I want to** protect the firm intelligence dashboard behind an access code **so that** only people I've given a code to can reach the data after hosting.

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@src/db/schema.ts
@src/db/client.ts
@src/app/layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install iron-session + add accessCodes schema + auth helpers</name>
  <files>src/db/schema.ts, src/lib/auth/session.ts, src/lib/auth/hash.ts</files>
  <read_first>
    - src/db/schema.ts (existing table definitions — append after findings table)
    - src/db/client.ts (db export pattern)
    - package.json (confirm iron-session not yet installed)
    - .env.local (check SESSION_SECRET exists — if not, note it must be added manually)
  </read_first>
  <action>
    **1a. Install iron-session:**
    ```bash
    npm install iron-session
    ```

    **1b. Add `accessCodes` table to `src/db/schema.ts`:**
    Append after the existing `findings` table. Import `boolean` from `drizzle-orm/pg-core` alongside existing imports.
    ```ts
    export const accessCodes = pgTable("access_codes", {
      id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
      codeHash: text("code_hash").notNull(),
      label: text("label").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }),
      lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
      active: boolean("active").default(true).notNull(),
    });
    ```
    Then run:
    ```bash
    npm run db:push
    ```

    **1c. Create `src/lib/auth/hash.ts`:**
    Use Node.js built-in `crypto.scrypt` — no new packages needed for hashing.
    ```ts
    import { scrypt, randomBytes, timingSafeEqual } from "crypto";
    import { promisify } from "util";

    const scryptAsync = promisify(scrypt);
    const KEYLEN = 64;

    export async function hashCode(plaintext: string): Promise<string> {
      const salt = randomBytes(16).toString("hex");
      const hash = (await scryptAsync(plaintext, salt, KEYLEN)) as Buffer;
      return `${salt}:${hash.toString("hex")}`;
    }

    export async function verifyCode(plaintext: string, stored: string): Promise<boolean> {
      const [salt, hashHex] = stored.split(":");
      if (!salt || !hashHex) return false;
      const storedBuf = Buffer.from(hashHex, "hex");
      const derivedBuf = (await scryptAsync(plaintext, salt, KEYLEN)) as Buffer;
      // timingSafeEqual prevents timing attacks
      return storedBuf.length === derivedBuf.length && timingSafeEqual(storedBuf, derivedBuf);
    }
    ```

    **1d. Create `src/lib/auth/session.ts`:**
    Use iron-session with Next.js `cookies()`.
    ```ts
    import { getIronSession, IronSession } from "iron-session";
    import { cookies } from "next/headers";

    export interface SessionData {
      isAuthenticated?: boolean;
    }

    const sessionOptions = {
      password: process.env.SESSION_SECRET as string,
      cookieName: "fid-session",
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    };

    export async function getSession(): Promise<IronSession<SessionData>> {
      return getIronSession<SessionData>(await cookies(), sessionOptions);
    }

    export async function setSession(): Promise<void> {
      const session = await getSession();
      session.isAuthenticated = true;
      await session.save();
    }

    export async function clearSession(): Promise<void> {
      const session = await getSession();
      session.destroy();
    }
    ```

    SESSION_SECRET must be set in `.env.local`. If the file exists but the key is absent, the app will throw at runtime. Add a comment at the top of session.ts: `// Requires SESSION_SECRET in .env.local — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  </action>
  <verify>
    <automated>npx tsc --noEmit && node -e "require('./src/lib/auth/hash.ts')" 2>/dev/null || npx tsx -e "import('./src/lib/auth/hash.ts').then(m => m.hashCode('test')).then(h => console.log('hash ok:', h.includes(':')))"</automated>
  </verify>
  <acceptance_criteria>
    - `npm ls iron-session` shows iron-session installed.
    - `grep -n "accessCodes" src/db/schema.ts` matches the new table.
    - `grep -n "timingSafeEqual" src/lib/auth/hash.ts` confirms timing-safe comparison.
    - `grep -n "SESSION_SECRET" src/lib/auth/session.ts` confirms env-var usage.
    - `grep -n "httpOnly: true" src/lib/auth/session.ts` confirms HttpOnly cookie.
    - `npx tsc --noEmit` reports no errors.
    - `npm run db:push` completes without error (access_codes table created).
  </acceptance_criteria>
  <done>iron-session installed, accessCodes table in schema and DB, hash helpers and session helpers created.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Code generation script + login page + verifyAccessCode server action</name>
  <files>src/scripts/generate-access-code.ts, src/app/login/page.tsx, src/app/login/actions.ts, src/app/login/actions.test.ts</files>
  <read_first>
    - src/lib/auth/hash.ts (hashCode, verifyCode)
    - src/lib/auth/session.ts (setSession, SessionData)
    - src/db/schema.ts (accessCodes table shape)
    - src/db/client.ts (db export)
    - src/app/page.tsx (page RSC pattern, header/layout style)
    - src/lib/actions/firm-actions.ts (server action pattern — "use server", zod validation style)
    - src/lib/actions/firm-actions.test.ts (vi.mock pattern for db)
  </read_first>
  <action>
    **2a. Create `src/scripts/generate-access-code.ts`:**
    Run with `npx tsx --env-file .env.local src/scripts/generate-access-code.ts --label "Luke"`.
    ```ts
    import { randomBytes } from "crypto";
    import { db } from "@/db/client";
    import { accessCodes } from "@/db/schema";
    import { hashCode } from "@/lib/auth/hash";

    const label = process.argv[process.argv.indexOf("--label") + 1] ?? "unnamed";
    const plaintext = randomBytes(16).toString("hex"); // 32-char hex code
    const codeHash = await hashCode(plaintext);

    await db.insert(accessCodes).values({ codeHash, label });
    console.log(`\nAccess code for "${label}":\n\n  ${plaintext}\n\nStore this — it will not be shown again.\n`);
    process.exit(0);
    ```

    **2b. Create `src/app/login/actions.ts`:**
    ```ts
    "use server";
    import { redirect } from "next/navigation";
    import { db } from "@/db/client";
    import { accessCodes } from "@/db/schema";
    import { verifyCode } from "@/lib/auth/hash";
    import { setSession } from "@/lib/auth/session";
    import { and, eq } from "drizzle-orm";

    export async function verifyAccessCode(formData: FormData): Promise<{ error: string } | never> {
      const input = (formData.get("code") as string | null)?.trim() ?? "";
      if (!input) return { error: "Access code is required." };

      const candidates = await db
        .select()
        .from(accessCodes)
        .where(and(eq(accessCodes.active, true)));

      for (const candidate of candidates) {
        const match = await verifyCode(input, candidate.codeHash);
        if (match) {
          // Check expiry
          if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
          // Update lastUsedAt (fire-and-forget; non-critical)
          db.update(accessCodes)
            .set({ lastUsedAt: new Date() })
            .where(eq(accessCodes.id, candidate.id))
            .catch(() => {});
          await setSession();
          redirect("/");
        }
      }

      // Generic error — no hint whether code exists or is expired
      return { error: "Invalid access code. Please try again." };
    }
    ```

    **2c. Write tests in `src/app/login/actions.test.ts`** (TDD — write first, then adjust action if needed):
    - Test 1: returns `{ error: "Access code is required." }` for empty input.
    - Test 2: returns `{ error: "Invalid access code. Please try again." }` when DB returns no candidates.
    - Test 3: calls `setSession()` and calls `redirect("/")` when a matching active unexpired candidate is found.
    - Test 4: returns error when candidate's `expiresAt` is in the past.
    Mock `@/db/client` (return controllable candidates), `@/lib/auth/hash` (verifyCode returns true/false), `@/lib/auth/session` (setSession spy), `next/navigation` (redirect spy).

    **2d. Create `src/app/login/page.tsx`:**
    Server component. If already authenticated (getSession().isAuthenticated), redirect("/").
    ```tsx
    import { getSession } from "@/lib/auth/session";
    import { redirect } from "next/navigation";
    import { verifyAccessCode } from "./actions";

    export default async function LoginPage() {
      const session = await getSession();
      if (session.isAuthenticated) redirect("/");

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="bg-white border border-neutral-200 rounded-xl p-8 w-full max-w-sm shadow-sm">
            <h1 className="text-xl font-semibold text-neutral-900 mb-1">Partnerships</h1>
            <p className="text-sm text-neutral-500 mb-6">Enter your access code to continue.</p>
            <LoginForm />
          </div>
        </div>
      );
    }
    ```
    Add a `LoginForm` client component in the same file (or `src/app/login/login-form.tsx`):
    - `<form action={verifyAccessCode}>` (progressive enhancement — no JS needed)
    - Single `<input name="code" type="password" placeholder="Access code" autoComplete="current-password" className="..." required />`
    - Submit button "Continue"
    - If the action returns `{ error }`, display it below the input in `text-sm text-red-600`
    - Use `useFormState` (React 19 `useActionState`) to handle the server action response.
    Style to match existing app: `Plus Jakarta Sans`, `border border-neutral-200 rounded-lg`, focus ring `ring-2 ring-blue-500`.
  </action>
  <verify>
    <automated>npx vitest run src/app/login/actions.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run src/app/login/actions.test.ts` passes with ≥4 test cases.
    - `grep -n "redirect\(\"/\"\)" src/app/login/actions.ts` confirms post-auth redirect.
    - `grep -n "timingSafeEqual\|verifyCode" src/app/login/actions.ts` — action uses verifyCode (not raw comparison).
    - `grep -n "Invalid access code" src/app/login/actions.ts` confirms generic error message.
    - `grep -n "getSession" src/app/login/page.tsx` confirms already-authed redirect.
    - `npx tsc --noEmit` clean.
  </acceptance_criteria>
  <done>Code generation script creates hashed codes; login page submits to verifyAccessCode server action which checks hash and sets session on success; generic error on failure; 4+ passing tests.</done>
</task>

<task type="auto">
  <name>Task 3: Middleware guard</name>
  <files>src/middleware.ts</files>
  <read_first>
    - src/lib/auth/session.ts (getSession, SessionData — note: iron-session works in middleware via NextRequest/NextResponse)
    - Next.js middleware docs pattern: export config.matcher to exclude /login, /_next, /favicon
  </read_first>
  <action>
    Create `src/middleware.ts` at the project root (next to `package.json`) — NOT inside `src/app/`.

    iron-session in middleware requires using `NextRequest`/`NextResponse` cookies rather than `next/headers`. Create a separate thin helper or inline the check:

    ```ts
    import { NextRequest, NextResponse } from "next/server";
    import { getIronSession } from "iron-session";
    import type { SessionData } from "@/lib/auth/session";

    const SESSION_OPTIONS = {
      password: process.env.SESSION_SECRET as string,
      cookieName: "fid-session",
      cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production" },
    };

    export async function middleware(request: NextRequest) {
      const response = NextResponse.next();
      const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS);

      if (!session.isAuthenticated) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return response;
    }

    export const config = {
      matcher: [
        /*
         * Match all paths except:
         * - /login (the auth page itself)
         * - /_next (Next.js internals)
         * - /favicon.ico, /robots.txt, /sitemap.xml
         * - Static files in /public (images, fonts, etc.)
         */
        "/((?!login|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
      ],
    };
    ```

    Note: the `SESSION_OPTIONS` object in middleware must match `cookieName` exactly with the one in `src/lib/auth/session.ts` (`fid-session`). Consider extracting a shared `SESSION_OPTIONS` constant to `src/lib/auth/constants.ts` and importing it in both files to prevent drift.
  </action>
  <verify>
    <automated>npx tsc --noEmit && grep -n "matcher" src/middleware.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/middleware.ts` exists at repo root level (sibling of `package.json`).
    - `grep -n "login" src/middleware.ts` confirms /login is excluded from protection.
    - `grep -n "isAuthenticated" src/middleware.ts` confirms session check.
    - `grep -n "SESSION_SECRET" src/middleware.ts` — either directly or via imported constants.
    - `grep -n "fid-session" src/middleware.ts` (or imported constant) — cookie name matches session.ts.
    - `npx tsc --noEmit` clean.
    - Manual smoke: `npm run dev`, visit `http://localhost:3000` — should redirect to `/login`. Enter a code generated by the script — should redirect to `/`. Refresh — should stay authenticated.
  </acceptance_criteria>
  <done>Middleware redirects all unauthenticated requests to /login; /login itself is excluded; session cookie is verified on every request.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /login form | User-supplied access code reaches the server action |
| Session cookie → middleware | Cookie value determines site access |
| DB access_codes table | Stores hashes; must never store plaintext |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-AUTH-01 | Spoofing | verifyAccessCode | mitigate | scrypt hash comparison via `timingSafeEqual` — no timing oracle |
| T-AUTH-02 | Tampering | Session cookie | mitigate | iron-session signs + encrypts cookie with SESSION_SECRET; tampered cookie is rejected |
| T-AUTH-03 | Information Disclosure | Login error message | mitigate | Generic "Invalid access code" regardless of whether code exists, is expired, or is wrong |
| T-AUTH-04 | Elevation of Privilege | /login bypass | mitigate | Middleware matcher covers all routes; /login exclusion is path-prefix only |
| T-AUTH-05 | Tampering | npm install | mitigate | Only `iron-session` added (well-known, maintained package); no other installs |
</threat_model>

<pre_flight>
Before starting Task 1, the operator must add `SESSION_SECRET` to `.env.local`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output → SESSION_SECRET=<output> in .env.local
```
The app and middleware will throw at runtime without this value.
</pre_flight>

<verification>
- `npx vitest run src/app/login/actions.test.ts` passes (≥4 tests).
- `npx tsc --noEmit` clean across all new files.
- `npm run db:push` created the `access_codes` table.
- Manual smoke: unauthenticated → redirected to /login; valid code → session set → redirect to /; refresh → still authenticated.
</verification>

<success_criteria>
- All routes except /login redirect unauthenticated visitors to /login.
- Valid active unexpired access code grants access via a signed HttpOnly session cookie.
- Invalid/expired codes return a generic error with no information leak.
- No plaintext codes in the database — only scrypt hashes.
- Operator can generate codes with `npx tsx --env-file .env.local src/scripts/generate-access-code.ts --label "Name"`.
</success_criteria>
