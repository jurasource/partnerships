"use client";

import * as React from "react";
import { X, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AliasChipsProps = {
  aliases: string[];
  onChange: (aliases: string[]) => void;
  suggestions?: string[];
  onAcceptSuggestion?: (suggestion: string) => void;
  onRejectSuggestion?: (suggestion: string) => void;
};

export function AliasChips({
  aliases,
  onChange,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
}: AliasChipsProps) {
  const [newAlias, setNewAlias] = React.useState("");

  function removeAlias(alias: string) {
    onChange(aliases.filter((a) => a !== alias));
  }

  function addAlias() {
    const trimmed = newAlias.trim();
    if (!trimmed || aliases.includes(trimmed)) {
      setNewAlias("");
      return;
    }
    onChange([...aliases, trimmed]);
    setNewAlias("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addAlias();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {aliases.map((alias) => (
          <span
            key={alias}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
          >
            {alias}
            <button
              type="button"
              onClick={() => removeAlias(alias)}
              className="ml-0.5 rounded-full hover:text-red-600 transition-colors"
              aria-label={`Remove alias "${alias}"`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {aliases.length === 0 && (
          <span className="text-xs text-neutral-400 italic self-center">
            No aliases yet
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add alias…"
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAlias}
          disabled={!newAlias.trim()}
          className="h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500">
            Suggested aliases — accept or reject:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <span
                key={suggestion}
                className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
              >
                {suggestion}
                <button
                  type="button"
                  onClick={() => onAcceptSuggestion?.(suggestion)}
                  className="ml-0.5 rounded-full hover:text-green-600 transition-colors"
                  aria-label={`Accept "${suggestion}"`}
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRejectSuggestion?.(suggestion)}
                  className="rounded-full hover:text-red-600 transition-colors"
                  aria-label={`Reject "${suggestion}"`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
