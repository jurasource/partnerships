"use client";

import { useState, useMemo, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { GroupScopeSelector } from "@/components/consortium/group-scope-selector";
import { PromptBuilder } from "@/components/consortium/prompt-builder";
import type { LockFirmsListItem } from "@/lib/queries/lock-firms";
import type { GroupForConsortium } from "@/lib/queries/groups-for-consortium";
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

type ConsortiumClientProps = {
  firms: LockFirmsListItem[];
  groups: GroupForConsortium[];
};

export function ConsortiumClient({ firms, groups }: ConsortiumClientProps) {
  // ── Shared: group scope ───────────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const scopedFirms = useMemo(() => {
    if (!selectedGroupId) return firms;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return firms;
    return firms.filter((f) => group.firmIds.includes(f.id));
  }, [firms, groups, selectedGroupId]);

  const groupFirmIds = useMemo(
    () => groups.find((g) => g.id === selectedGroupId)?.firmIds ?? [],
    [groups, selectedGroupId],
  );

  // ── Recommender tab state ─────────────────────────────────────────────────
  const [capabilityMix, setCapabilityMix] = useState<CapabilityMix>(DEFAULT_MIX);
  const [lockedFirmIds, setLockedFirmIds] = useState<string[]>([]);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // When group changes, pre-lock all group members and clear prior result
  useEffect(() => {
    setLockedFirmIds(groupFirmIds);
    setResult(null);
  }, [groupFirmIds]);

  const mixTotal = capabilityMix.Consultancy + capabilityMix.Infrastructure + capabilityMix.Nuclear;
  const isDisabled = mixTotal === 0 || loading;

  function handleToggleFirm(firmId: string) {
    setLockedFirmIds((prev) =>
      prev.includes(firmId) ? prev.filter((id) => id !== firmId) : [...prev, firmId],
    );
  }

  async function submit(overrideLocks?: string[]) {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        capabilityMix,
        lockedFirmIds: overrideLocks ?? lockedFirmIds,
        weights,
      };
      if (selectedGroupId) {
        body.poolFirmIds = groupFirmIds;
      }

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let serverMessage = "Unexpected error";
        try {
          const json = await res.json() as { error?: string };
          serverMessage = json.error ?? serverMessage;
        } catch {
          // ignore
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
    setLockedFirmIds(groupFirmIds);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Group scope selector — shared across both tabs */}
      <GroupScopeSelector groups={groups} value={selectedGroupId} onChange={setSelectedGroupId} />

      <Tabs defaultValue="recommender">
        <TabsList>
          <TabsTrigger value="recommender">Recommender</TabsTrigger>
          <TabsTrigger value="prompt-builder">AI Prompt Builder</TabsTrigger>
        </TabsList>

        {/* ── Recommender tab ───────────────────────────────────────────── */}
        <TabsContent value="recommender" className="mt-6">
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">Capability Mix</h2>
              <CapabilityMixInput value={capabilityMix} onChange={setCapabilityMix} />
            </section>

            <Accordion>
              <AccordionItem value="lock-firms">
                <AccordionTrigger className="text-sm font-semibold">
                  Lock firms (optional)
                </AccordionTrigger>
                <AccordionContent>
                  <LockFirmsSection
                    firms={scopedFirms}
                    lockedIds={lockedFirmIds}
                    onToggle={handleToggleFirm}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

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

            {result && (
              <RecommendationResult
                response={result}
                onRecompute={handleRecompute}
                onReset={handleReset}
              />
            )}
          </div>
        </TabsContent>

        {/* ── AI Prompt Builder tab ─────────────────────────────────────── */}
        <TabsContent value="prompt-builder" className="mt-6">
          <PromptBuilder firms={scopedFirms} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
