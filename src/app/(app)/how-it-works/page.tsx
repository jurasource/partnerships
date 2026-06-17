import { Info } from "lucide-react";
import { MermaidDiagram } from "@/components/how-it-works/mermaid-diagram";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const RESEARCH_FLOW = `
flowchart TD
    A([User triggers research]) --> B[Job added to queue]
    B --> C[Research Worker picks up job]
    C --> D[Build grounding context\nCo. House + procurement history]
    D --> E{For each research topic}
    E --> F[Tavily web search\nreturns relevant pages + URLs]
    F --> G[Claude LLM synthesises\nfindings with citations]
    G --> H{Valid finding\nwith source?}
    H -- Yes --> I[(Store finding\nin Postgres)]
    H -- No --> J[(Store 'not found'\nsentinel)]
    I --> E
    J --> E
    E -- All topics done --> K([Dashboard updated])
`;

const DATA_SOURCES_FLOW = `
flowchart LR
    subgraph Web["🌐 Web (via Tavily)"]
        T1[News articles]
        T2[Company websites]
        T3[Industry reports]
        T4[Government announcements]
    end

    subgraph CH["🏢 Companies House API"]
        C1[Registered address &\ncompany status]
        C2[Directors & officers]
        C3[Persons with\nSignificant Control]
        C4[Ownership structure]
    end

    subgraph OCDS["📋 UK Procurement APIs"]
        O1[Find a Tender Service\nabove-threshold contracts]
        O2[Contracts Finder\nbelow-threshold contracts]
    end

    Web --> DB[(Postgres)]
    CH --> DB
    OCDS --> DB
    DB --> DASH[Dashboard]
`;

const CONSORTIUM_FLOW = `
flowchart LR
    A[Select firms\n& capability mix] --> B[Scoring engine]
    B --> C{Score each\ncombination}
    C --> D[Contract relevance]
    C --> E[UK ownership]
    C --> F[Prior partnerships]
    C --> G[Risk flags]
    D & E & F & G --> H[Weighted total score]
    H --> I([Ranked shortlist])
`;

const AI_CONSORTIUM_FLOW = `
flowchart LR
    A([Describe opportunity\n& define roles]) --> B[Set constraints]
    B --> C[Prompt assembled\nfirm profiles +\nresearch findings]
    C --> D[Claude reasons\nover full context]
    D --> E[3 consortium suggestions\nstream back]
    E --> F([Export markdown\nor JSON])
`;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function DiagramCard({
  title,
  chart,
  id,
}: {
  title?: string;
  chart: string;
  id: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
      {title && (
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">
          {title}
        </p>
      )}
      <MermaidDiagram chart={chart} id={id} />
    </div>
  );
}

function LimitationItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
      <span className="text-neutral-700 text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function ImprovementItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-blue-500">→</span>
      <span className="text-neutral-700 text-sm leading-relaxed">{children}</span>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="flex flex-col min-h-full">
      <header className="px-6 py-6 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-neutral-100 p-2">
            <Info className="h-5 w-5 text-neutral-600" />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-neutral-900">
              How it works
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              A plain-English guide to what this system does, where the data
              comes from, and what it can and cannot do.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full space-y-16">

        {/* Overview */}
        <Section title="What is this system?">
          <p className="text-sm text-neutral-700 leading-relaxed">
            Partnerships is a firm intelligence dashboard built for bid and
            consortium planning in UK civil nuclear programmes. Given
            a list of firms you are considering teaming with, it automatically
            researches each one across a set of topics — capabilities, contract
            history, ownership structure, known partnerships, risk signals — and
            surfaces the results in one place so you can compare, filter, and
            decide who to work with, and in what combination.
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed">
            All data is sourced from the public domain: web search results,
            Companies House (the UK corporate registry), and two official UK
            government procurement APIs. Nothing proprietary or paid is used.
          </p>
        </Section>

        <Separator />

        {/* Research flow */}
        <Section title="How research works">
          <p className="text-sm text-neutral-700 leading-relaxed">
            When you trigger research on a firm, the system runs a pipeline for
            each of your configured research topics. For every topic it performs
            a targeted web search (via Tavily), feeds the retrieved pages and
            your firm's structured background data to a Claude AI model, and
            asks it to synthesise a concise finding — with a source URL and
            confidence level. Findings that cannot be verified against a real
            source are discarded rather than hallucinated.
          </p>
          <DiagramCard chart={RESEARCH_FLOW} id="research-flow" title="Research pipeline" />
          <p className="text-xs text-neutral-500 leading-relaxed">
            Jobs are queued using BullMQ so multiple firms can be researched
            concurrently without overwhelming the AI or search APIs. Each job's
            progress is visible on the Jobs page.
          </p>
        </Section>

        <Separator />

        {/* Data sources */}
        <Section title="Where the data comes from">
          <p className="text-sm text-neutral-700 leading-relaxed">
            Three data sources feed the database. They complement each other:
            structured APIs give verifiable facts; web search fills reputation,
            partnership, and capability gaps that APIs don't cover.
          </p>
          <DiagramCard chart={DATA_SOURCES_FLOW} id="data-sources" title="Data sources" />
          <div className="grid sm:grid-cols-3 gap-4 mt-2">
            {[
              {
                label: "Tavily web search",
                desc: "Purpose-built search API that returns cleaned, citation-ready page content. Used to find news, capability evidence, and partnership signals.",
              },
              {
                label: "Companies House API",
                desc: "Free UK government API. Provides legal company status, registered address, director names, and Persons with Significant Control (ownership).",
              },
              {
                label: "UK Procurement APIs",
                desc: "Find a Tender Service (above-threshold) and Contracts Finder (below-threshold) supply OCDS-standard JSON contract award data.",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-neutral-200 bg-white p-4 space-y-1"
              >
                <p className="text-sm font-medium text-neutral-900">{s.label}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        {/* What each section does */}
        <Section title="What each section of the app does">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                label: "Dashboard",
                badge: "/",
                desc: "Side-by-side comparison table of all firms across every research topic. Filter by topic, capability tag, or search. The primary starting point for firm comparisons.",
              },
              {
                label: "Analysis",
                badge: "/analysis",
                desc: "Cross-cutting intelligence: prior partnerships between firms, conflict signals (e.g. firms that compete directly), and ownership/nationality rollup across the full set.",
              },
              {
                label: "Firms",
                badge: "/firms",
                desc: "Full directory of firms. Add, edit, and view per-firm profiles. Each profile shows all research findings by topic, Companies House data, contract history, and risk flags.",
              },
              {
                label: "Groups",
                badge: "/groups",
                desc: "Organise firms into named groups (e.g. by programme, by geography). Groups scope the Consortium tool so you only score combinations within a relevant set.",
              },
              {
                label: "Topics",
                badge: "/topics",
                desc: "Manage research topics — the questions posed to the AI for each firm. Topics can be added, renamed, or removed. Changes take effect on the next research run.",
              },
              {
                label: "Consortium",
                badge: "/consortium",
                desc: "Scoring engine for potential team combinations. Configure the capability mix you need and weighting of scoring dimensions, then get a ranked shortlist of combinations with score breakdowns.",
              },
              {
                label: "Jobs",
                badge: "/jobs",
                desc: "Monitor active and completed research jobs. Shows progress per firm, errors, and timestamps. Useful when running bulk research across many firms.",
              },
              {
                label: "Report",
                badge: "/report",
                desc: "A pre-built static report: the best 1+1+1 consortium from the seeded dataset, using equal weights across all scoring dimensions.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-neutral-200 bg-white p-4 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">
                    {item.label}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono px-1.5 py-0"
                  >
                    {item.badge}
                  </Badge>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        {/* Consortium scoring */}
        <Section title="How consortium scoring works">
          <p className="text-sm text-neutral-700 leading-relaxed">
            The Consortium tool scores every valid combination of firms against
            four dimensions. You control the weighting of each dimension via
            sliders. Combinations that include directly conflicting firms are
            excluded before scoring.
          </p>
          <DiagramCard chart={CONSORTIUM_FLOW} id="consortium-flow" title="Consortium scoring" />
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            {[
              { label: "Contract relevance", desc: "How closely the firm's procurement history matches the programme domain." },
              { label: "UK ownership", desc: "Whether the firm is UK-owned or foreign-owned, based on Companies House PSC data." },
              { label: "Prior partnerships", desc: "Whether firms in the combination have previously worked together on contracts." },
              { label: "Risk flags", desc: "Presence of AI-surfaced risk signals such as financial stress, legal issues, or reputational concerns." },
            ].map((d) => (
              <div key={d.label} className="rounded-lg border border-neutral-200 bg-white p-4 space-y-1">
                <p className="text-sm font-medium text-neutral-900">{d.label}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        {/* AI Prompt Builder */}
        <Section title="AI-assisted consortium suggestions">
          <p className="text-sm text-neutral-700 leading-relaxed">
            The Consortium page has two modes. The <strong>Recommender</strong> tab
            (described above) uses a deterministic scoring engine — it calculates
            a numerical score for every valid firm combination and ranks them.
            The <strong>AI Prompt Builder</strong> tab takes a different approach:
            it hands the problem to Claude.
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed">
            You describe the opportunity in plain English, define the roles you
            need filled (each with capability tags), and set constraints. The
            system then assembles a structured prompt that includes every firm's
            full research findings, ownership data, risk flags, and known
            partnerships — and asks Claude to reason over all of it and suggest
            three optimal consortium configurations. Results stream back in real
            time and can be exported as markdown or JSON.
          </p>
          <DiagramCard chart={AI_CONSORTIUM_FLOW} id="ai-consortium-flow" title="AI Prompt Builder flow" />
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900">Recommender vs AI Prompt Builder</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-1">
              <div className="bg-white rounded-md border border-blue-100 p-3 space-y-1">
                <p className="text-xs font-semibold text-neutral-800">Recommender</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Deterministic. Scores every combination numerically across
                  four weighted dimensions. Fully auditable — you can see exactly
                  why a team scored as it did. Best when you want to compare
                  many combinations objectively or apply strict weighting (e.g.
                  prioritise UK ownership above all else).
                </p>
              </div>
              <div className="bg-white rounded-md border border-blue-100 p-3 space-y-1">
                <p className="text-xs font-semibold text-neutral-800">AI Prompt Builder</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Qualitative. Claude reads the full research narrative for each
                  firm and applies judgment — it can spot complementary strengths,
                  surface nuanced risks, and reason about strategic fit in ways
                  the scoring engine cannot. Best when the decision is complex
                  or when you want a written rationale ready to paste into a bid
                  document.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            The AI suggestions are only as good as the research data behind them.
            Run research on all firms before using this feature — sparse or
            missing findings will produce weaker suggestions.
          </p>
        </Section>

        <Separator />

        {/* Known limitations */}
        <Section title="Known limitations">
          <ul className="space-y-3">
            <LimitationItem>
              <strong>Public data only.</strong> The system uses only freely
              available sources. Proprietary market intelligence, paid
              procurement databases, and restricted government data are not
              included.
            </LimitationItem>
            <LimitationItem>
              <strong>Name-matching noise.</strong> Firms are matched to
              procurement records primarily by company name. Many similarly
              named entities exist in UK civil nuclear — a match does not
              guarantee it refers to the correct legal entity. Companies House
              number matching is used where available to reduce this, but
              ambiguity remains for some records.
            </LimitationItem>
            <LimitationItem>
              <strong>Research quality depends on LLM and search coverage.</strong>{" "}
              The AI synthesises findings from what Tavily retrieves. If a
              firm has limited public web presence, findings may be sparse or
              marked "not found". The AI may occasionally misattribute a finding
              to a source — always verify important claims directly.
            </LimitationItem>
            <LimitationItem>
              <strong>No live refresh.</strong> Research is triggered manually.
              Findings reflect what was publicly available at the time of the
              last research run. There is no automatic monitoring for new
              contracts, news, or ownership changes.
            </LimitationItem>
            <LimitationItem>
              <strong>Tavily free-tier rate limits.</strong> On the free Tavily
              plan, large batch research runs (many firms × many topics) may
              slow down or hit rate limits. The job queue handles retries but a
              paid Tavily plan is recommended for production use.
            </LimitationItem>
            <LimitationItem>
              <strong>Ownership depth is limited.</strong> Companies House PSC
              data reflects direct ownership. Multi-layer ownership chains
              (e.g. a UK subsidiary of a foreign holding company) may not be
              fully resolved.
            </LimitationItem>
            <LimitationItem>
              <strong>Local-first deployment.</strong> The system runs locally.
              It is not designed for concurrent multi-user access in its current
              form and has not been hardened for public internet exposure.
            </LimitationItem>
          </ul>
        </Section>

        <Separator />

        {/* Areas for improvement */}
        <Section title="Areas for improvement">
          <ul className="space-y-3">
            <ImprovementItem>
              <strong>Automated monitoring &amp; alerts.</strong> Schedule
              periodic re-research runs and surface changes — new contract
              awards, news articles, or ownership changes — as notifications
              rather than requiring manual re-runs.
            </ImprovementItem>
            <ImprovementItem>
              <strong>Richer ownership resolution.</strong> Traverse multi-layer
              PSC chains using Companies House group data to produce a full
              beneficial ownership picture, including ultimate parent nationality.
            </ImprovementItem>
            <ImprovementItem>
              <strong>Semantic search over findings.</strong> Add a vector
              store so users can free-text search across all firm findings (e.g.
              "who has experience in small modular reactors?") rather than
              browsing topic by topic.
            </ImprovementItem>
            <ImprovementItem>
              <strong>PDF / Word export.</strong> Generate a formatted report of
              a shortlisted consortium — firm profiles, scoring rationale, and
              source citations — ready to paste into a bid document.
            </ImprovementItem>
            <ImprovementItem>
              <strong>Confidence scoring improvements.</strong> Currently
              findings are HIGH or MEDIUM confidence. A finer-grained model
              (with source count and recency signals) would help users prioritise
              which findings to verify manually.
            </ImprovementItem>
            <ImprovementItem>
              <strong>Cloud / multi-user deployment.</strong> Move from
              local-first to a hosted deployment with role-based access, so
              multiple bid team members can share a live dashboard without
              running the stack locally.
            </ImprovementItem>
            <ImprovementItem>
              <strong>Broader data sources.</strong> Integrate additional
              procurement feeds (e.g. NDA supply chain portal,
              NDA supply chain data), news APIs, or Companies House filing
              history for financial health signals.
            </ImprovementItem>
            <ImprovementItem>
              <strong>Conflict detection improvements.</strong> Current conflict
              detection is based on AI-surfaced signals and manual flags. A
              more systematic approach — cross-referencing NDA exclusion lists,
              framework agreements, or sanctions registers — would be more
              reliable.
            </ImprovementItem>
          </ul>
        </Section>

        <div className="pt-4 pb-8 text-xs text-neutral-400 text-center">
          Built on Next.js · Vercel AI SDK · Anthropic Claude · Tavily · Companies House API · Find a Tender · Contracts Finder
        </div>
      </div>
    </main>
  );
}
