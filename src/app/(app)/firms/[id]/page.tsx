import { notFound } from "next/navigation";
import { getFirmProfile } from "@/lib/queries/firm-profile";
import { FirmProfileLayout } from "@/components/firms/firm-profile-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FirmProfilePage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getFirmProfile(id);

  if (!profile) {
    notFound();
  }

  return <FirmProfileLayout profile={profile} />;
}
