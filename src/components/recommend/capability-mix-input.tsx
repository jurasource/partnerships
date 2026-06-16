"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CapabilityMix = {
  Consultancy: number;
  Infrastructure: number;
  Nuclear: number;
};

type CapabilityMixInputProps = {
  value: CapabilityMix;
  onChange: (value: CapabilityMix) => void;
};

const CAPABILITY_LABELS: Array<keyof CapabilityMix> = [
  "Consultancy",
  "Infrastructure",
  "Nuclear",
];

const MIN = 0;
const MAX = 5;

export function CapabilityMixInput({ value, onChange }: CapabilityMixInputProps) {
  function handleDecrement(key: keyof CapabilityMix) {
    const next = Math.max(MIN, value[key] - 1);
    onChange({ ...value, [key]: next });
  }

  function handleIncrement(key: keyof CapabilityMix) {
    const next = Math.min(MAX, value[key] + 1);
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Set the number of firms needed for each capability.
      </p>
      <div className="flex gap-6 flex-wrap">
        {CAPABILITY_LABELS.map((key) => {
          const count = value[key];
          return (
            <div key={key} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {key}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => handleDecrement(key)}
                  disabled={count <= MIN}
                  aria-label={`Decrease ${key}`}
                >
                  −
                </Button>
                <span
                  className={cn(
                    "text-lg font-semibold font-mono w-8 text-center",
                    count === 0 ? "text-neutral-300" : "text-neutral-900"
                  )}
                >
                  {count}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => handleIncrement(key)}
                  disabled={count >= MAX}
                  aria-label={`Increase ${key}`}
                >
                  +
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
