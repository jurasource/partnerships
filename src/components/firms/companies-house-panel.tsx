import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  CompanyProfile,
  PscRecord,
  OfficersRecord,
} from "@/lib/clients/companies-house";

export type CHData = {
  profile: CompanyProfile | null;
  psc: PscRecord | null;
  officers: OfficersRecord | null;
};

const COMPANY_TYPES: Record<string, string> = {
  ltd: "Private Limited Company",
  llp: "Limited Liability Partnership",
  plc: "Public Limited Company",
  "private-limited-guarant-nsc": "Company Limited by Guarantee",
  "private-unlimited": "Unlimited Company",
  "royal-charter": "Royal Charter",
};

const JURISDICTIONS: Record<string, string> = {
  "england-wales": "England & Wales",
  scotland: "Scotland",
  "northern-ireland": "Northern Ireland",
  "united-kingdom": "United Kingdom",
};

function formatType(t: string): string {
  return (
    COMPANY_TYPES[t] ??
    t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatJurisdiction(j: string): string {
  return (
    JURISDICTIONS[j] ??
    j.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAddress(addr: CompanyProfile["registered_office_address"]): string | null {
  if (!addr) return null;
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.postal_code,
  ].filter(Boolean);
  return parts.join(", ") || null;
}

function formatPscKind(kind: string): string {
  if (kind.startsWith("individual")) return "Individual";
  if (kind.startsWith("corporate")) return "Corporate";
  if (kind.startsWith("legal")) return "Legal Person";
  return kind;
}

function formatOfficerRole(role: string): string {
  const map: Record<string, string> = {
    director: "Director",
    secretary: "Secretary",
    "llp-member": "LLP Member",
    "llp-designated-member": "Designated Member",
    "corporate-director": "Corporate Director",
    "corporate-secretary": "Corporate Secretary",
  };
  return (
    map[role] ??
    role.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    dissolved: "bg-red-100 text-red-700 border-red-200",
    liquidation: "bg-amber-100 text-amber-700 border-amber-200",
  };
  const label =
    status === "active"
      ? "Active"
      : status === "dissolved"
        ? "Dissolved"
        : status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs px-1.5 py-0.5 border",
        styles[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200",
      )}
    >
      {label}
    </Badge>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 w-40 shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-neutral-700 min-w-0">{children}</dd>
    </div>
  );
}

type Props = { chData: CHData | null; hasChNumber: boolean };

export function CompaniesHousePanel({ chData, hasChNumber }: Props) {
  if (!chData || !chData.profile) {
    let message: string;
    if (!hasChNumber) {
      message = "No Companies House number recorded.";
    } else if (!chData) {
      message = "No snapshot yet — run the analysis to fetch Companies House data.";
    } else {
      message = "Data unavailable from Companies House.";
    }
    return (
      <section className="px-6 py-6 border-t border-neutral-200">
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Companies House
        </h2>
        <p className="text-sm text-neutral-500">{message}</p>
      </section>
    );
  }

  const { profile, psc, officers } = chData;
  const address = formatAddress(profile.registered_office_address);
  const pscItems = psc?.items ?? [];
  const officerItems = (officers?.items ?? []).slice(0, 6);
  const totalOfficers = officers?.active_count ?? officerItems.length;

  return (
    <section className="px-6 py-6 border-t border-neutral-200">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4">
        Companies House
      </h2>

      {/* Company details */}
      <dl className="flex flex-col gap-3">
        <Row label="Registered Name">{profile.company_name}</Row>
        {profile.company_status && (
          <Row label="Status">
            <StatusBadge status={profile.company_status} />
          </Row>
        )}
        {profile.type && (
          <Row label="Company Type">{formatType(profile.type)}</Row>
        )}
        {profile.date_of_creation && (
          <Row label="Incorporated">{formatDate(profile.date_of_creation)}</Row>
        )}
        {profile.jurisdiction && (
          <Row label="Jurisdiction">
            {formatJurisdiction(profile.jurisdiction)}
          </Row>
        )}
        {address && <Row label="Registered Address">{address}</Row>}
      </dl>

      {/* PSC */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Persons with Significant Control
        </h3>
        {pscItems.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">None recorded</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {pscItems.map((item, i) => (
              <li key={i} className="text-sm text-neutral-700">
                <span className="font-medium">{item.name ?? "—"}</span>
                {item.kind && (
                  <span className="ml-1.5 text-xs text-neutral-500">
                    ({formatPscKind(item.kind)})
                  </span>
                )}
                {(item.nationality ??
                  item.country_of_residence ??
                  item.identification?.country_of_registration) && (
                  <span className="ml-1.5 text-xs text-neutral-400">
                    ·{" "}
                    {item.nationality ??
                      item.country_of_residence ??
                      item.identification?.country_of_registration}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Officers */}
      {officerItems.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Officers
            {totalOfficers > officerItems.length && (
              <span className="ml-1 font-normal normal-case text-neutral-400">
                (showing {officerItems.length} of {totalOfficers})
              </span>
            )}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {officerItems.map((officer, i) => (
              <li key={i} className="text-sm text-neutral-700">
                <span className="font-medium">{officer.name ?? "—"}</span>
                {officer.officer_role && (
                  <span className="ml-1.5 text-xs text-neutral-500">
                    ({formatOfficerRole(officer.officer_role)})
                  </span>
                )}
                {officer.appointed_on && (
                  <span className="ml-1.5 text-xs text-neutral-400">
                    · from {formatDate(officer.appointed_on)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
