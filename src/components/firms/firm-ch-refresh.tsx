"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshCHData } from "@/lib/actions/research-actions";

export function FirmCHRefresh({ firmId }: { firmId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleRefresh() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await refreshCHData(firmId);
      if (result.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={loading}
      title="Fetch latest data from Companies House and update snapshot"
      className={cn("gap-1.5", loading && "opacity-75 cursor-not-allowed")}
    >
      <Building2 className={cn("h-3.5 w-3.5", loading && "animate-pulse")} aria-hidden="true" />
      {loading ? "Fetching…" : "Refresh CH Data"}
    </Button>
  );
}
