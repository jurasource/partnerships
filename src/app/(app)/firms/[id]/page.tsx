import { notFound } from "next/navigation";
import { getFirmProfile } from "@/lib/queries/firm-profile";
import { FirmProfileLayout } from "@/components/firms/firm-profile-page";
import type { CompanyProfile, PscRecord, OfficersRecord } from "@/lib/clients/companies-house";
import type { CHData } from "@/components/firms/companies-house-panel";
import { db } from "@/db/client";
import { firms } from "@/db/schema";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FirmProfilePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch profile and all firms in parallel.
  // allFirms is used by conflict/partnership sections to resolve counterpart names.
  const [profile, allFirms] = await Promise.all([
    getFirmProfile(id),
    db.select().from(firms),
  ]);

  if (!profile) {
    notFound();
  }

  // Parse cached CH snapshot from DB — no live API calls on page load.
  // Snapshot is written (upserted) during each cross-cutting analysis job.
  const snap = profile.chSnapshot;
  const chData: CHData | null = snap
    ? {
        profile: snap.profileJson
          ? (JSON.parse(snap.profileJson) as CompanyProfile)
          : null,
        psc: snap.pscJson ? (JSON.parse(snap.pscJson) as PscRecord) : null,
        officers: snap.officersJson
          ? (JSON.parse(snap.officersJson) as OfficersRecord)
          : null,
      }
    : null;

  return <FirmProfileLayout profile={profile} allFirms={allFirms} chData={chData} />;
}
