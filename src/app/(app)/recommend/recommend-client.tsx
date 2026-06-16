"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CapabilityMixInput, type CapabilityMix } from "@/components/recommend/capability-mix-input";
import { WeightSliders, type ScoringWeights } from "@/components/recommend/weight-sliders";
import { LockFirmsSection } from "@/components/recommend/lock-firms-section";
import { RecommendationResult } from "@/components/recommend/recommendation-result";
import type { LockFirmsListItem } from "@/lib/queries/lock-firms";
import type { RecommendResponse } from "@/lib/recommend/schemas";

const DEFAULT_MIX: CapabilityMix = {
  Consultancy: 0,
  Infrastructure: 0,
  Nuclear: 0,
};

const DEFAULT_WEIGHTS: ScoringWeights = {
  partnerships: 25,
  ukOwnership: 25,
  contractRelevance: 25,
  riskFlags: 25,
};

type RecommendClientProps = {
  firms: LockFirmsListItem[];
};

export function RecommendClient({ firms }: RecommendClientProps) {
  const [capabilityMix, setCapabilityMix] = useState<CapabilityMix>(DEFAULT_MIX);
  const [lockedFirmIds, setLockedFirmIds] = useState<string[]>([]);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const mixTotal = capabilityMix.Consultancy + capabilityMix.Infrastructure + capabilityMix.Nuclear;
  const isDisabled = mixTotal === 0 || loading;

  function handleToggleFirm(firmId: string) {
    setLockedFirmIds((prev) =>
      prev.includes(firmId) ? prev.filter((id) => id !== firmId) : [...prev, firmId]
    );
  }

  async function submit(overrideLocks?: string[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capabilityMix,
          lockedFirmIds: overrideLocks ?? lockedFirmIds,
          weights,
        }),
      });

      if (!res.ok) {
        let serverMessage = "Unexpected error";
        try {
          const json = await res.json() as { error?: string };
          serverMessage = json.error ?? serverMessage;
        } catch {
          // ignore parse error
        }
        toast.error(`Could not compute recommendation. ${serverMessage}.`);
        return;
      }

      const data = await res.json() as RecommendResponse;
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      toast.error(`Could not compute recommendation. ${message}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleRecompute(firmIds: string[]) {
    setLockedFirmIds(firmIds);
    void submit(firmIds);
  }

  function handleReset() {
    setLockedFirmIds([]);
    setResult(null);
  }

  return (
    <>
      {/* Section 1: Capability Mix */}
      <section>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Capability Mix</h2>
        <CapabilityMixInput value={capabilityMix} onChange={setCapabilityMix} />
      </section>

      {/* Section 2: Lock Firms (collapsible) */}
      <Accordion>
        <AccordionItem value="lock-firms">
          <AccordionTrigger className="text-sm font-semibold">
            Lock firms (optional)
          </AccordionTrigger>
          <AccordionContent>
            <LockFirmsSection
              firms={firms}
              lockedIds={lockedFirmIds}
              onToggle={handleToggleFirm}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Section 3: Scoring Weights (collapsible) */}
      <Accordion>
        <AccordionItem value="weights">
          <AccordionTrigger className="text-sm font-semibold">
            Scoring weights
          </AccordionTrigger>
          <AccordionContent>
            <WeightSliders value={weights} onChange={setWeights} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Submit */}
      <Button
        className="bg-blue-600 text-white w-full sm:w-auto hover:bg-blue-700"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        onClick={() => void submit()}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Computing...
          </>
        ) : (
          "Get Recommendation"
        )}
      </Button>

      {/* Section 4: Result (shown only after API response) */}
      {result && (
        <RecommendationResult
          response={result}
          onRecompute={handleRecompute}
          onReset={handleReset}
        />
      )}
    </>
  );
}
