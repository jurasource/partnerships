"use client";

import { Slider } from "@/components/ui/slider";

export type ScoringWeights = {
  partnerships: number;
  ukOwnership: number;
  contractRelevance: number;
  riskFlags: number;
};

type WeightSlidersProps = {
  value: ScoringWeights;
  onChange: (value: ScoringWeights) => void;
};

const SLIDER_ROWS: Array<{
  key: keyof ScoringWeights;
  label: string;
  id: string;
}> = [
  { key: "partnerships", label: "Prior partnerships", id: "weight-partnerships" },
  { key: "ukOwnership", label: "UK ownership", id: "weight-uk-ownership" },
  { key: "contractRelevance", label: "Contract relevance", id: "weight-contract-relevance" },
  { key: "riskFlags", label: "Risk profile", id: "weight-risk-flags" },
];

export function WeightSliders({ value, onChange }: WeightSlidersProps) {
  function handleChange(key: keyof ScoringWeights, newValue: number | readonly number[]) {
    const numVal = Array.isArray(newValue) ? (newValue as number[])[0] : (newValue as number);
    if (numVal !== undefined) {
      onChange({ ...value, [key]: numVal });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Adjust how each signal affects the score. Weights are normalised automatically.
      </p>
      <div className="flex flex-col gap-6">
        {SLIDER_ROWS.map(({ key, label, id }) => (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={id}
                className="text-xs font-semibold uppercase tracking-wide text-neutral-600"
              >
                {label}
              </label>
              <span className="font-mono text-xs text-neutral-500">{value[key]}</span>
            </div>
            <Slider
              id={id}
              min={0}
              max={100}
              step={1}
              value={[value[key]]}
              onValueChange={(v) => handleChange(key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
