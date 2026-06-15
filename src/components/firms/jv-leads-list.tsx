"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirmFormDialog } from "@/components/firms/firm-form-dialog";
import type { JvLead } from "@/lib/types";

type Props = {
  leads: JvLead[];
};

export function JvLeadsList({ leads }: Props) {
  const router = useRouter();

  if (leads.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-neutral-700 mb-1">
        Potential JV Partners
      </h3>
      <p className="text-xs text-neutral-500 mb-2">
        These firms were mentioned in AI research as JV partners but are not yet
        tracked. Add them to start researching and see their profile here.
      </p>
      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900">
                {lead.mentionedFirmName}
              </p>
              {lead.evidenceSummary && (
                <p className="text-xs text-neutral-500 mt-0.5">
                  {lead.evidenceSummary}
                </p>
              )}
              {lead.evidenceDate && (
                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                  {new Date(lead.evidenceDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <FirmFormDialog
              defaultName={lead.mentionedFirmName}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 px-2 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  <Plus className="h-3 w-3" />
                  Add Firm
                </Button>
              }
              onSuccess={() => router.refresh()}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
