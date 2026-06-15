import { notFound } from "next/navigation";
import { getFirmProfile } from "@/lib/queries/firm-profile";
import { FirmProfileLayout } from "@/components/firms/firm-profile-page";
import { getCompanyProfile, getPSC, getOfficers } from "@/lib/clients/companies-house";
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

  // Fetch all CH data in parallel if a CH number is recorded.
  const chNumber = profile.firm.companiesHouseNumber;
  const chData = chNumber
    ? await Promise.all([
        getCompanyProfile(chNumber).catch(() => null),
        getPSC(chNumber).catch(() => null),
        getOfficers(chNumber).catch(() => null),
      ]).then(([chProfile, psc, officers]) => ({ profile: chProfile, psc, officers }))
    : null;

  return <FirmProfileLayout profile={profile} allFirms={allFirms} chData={chData} />;
}
