// src/lib/recommend/schemas.ts
// Pure Zod 4 request/response schemas for the consortium recommender.
//
// Import-clean: no framework-specific imports.
// Must be importable by Vitest in a Node environment without any Next.js module loading.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

export const CapabilityMixSchema = z
  .object({
    Consultancy: z.number().int().min(0).max(5),
    Infrastructure: z.number().int().min(0).max(5),
    Nuclear: z.number().int().min(0).max(5),
  })
  .refine((mix) => Object.values(mix).some((v) => v > 0), {
    message: "At least one capability slot must be requested",
  });

export const ScoringWeightsSchema = z.object({
  contractRelevance: z.number().min(0).max(100),
  ukOwnership: z.number().min(0).max(100),
  partnerships: z.number().min(0).max(100),
  riskFlags: z.number().min(0).max(100),
});

export const RecommendRequestSchema = z.object({
  capabilityMix: CapabilityMixSchema,
  lockedFirmIds: z.array(z.string().uuid()).default([]),
  weights: ScoringWeightsSchema.default({
    contractRelevance: 25,
    ukOwnership: 25,
    partnerships: 25,
    riskFlags: 25,
  }),
  poolFirmIds: z.array(z.string().uuid()).optional(),
});

// ---------------------------------------------------------------------------
// Response schema — the shape the UI depends on
// ---------------------------------------------------------------------------

export const FirmScoreBreakdownSchema = z.object({
  firmId: z.string().uuid(),
  firmName: z.string(),
  signalScores: z.object({
    contractRelevance: z.number().min(0).max(1),
    ukOwnership: z.number().min(0).max(1),
    riskFlags: z.number().min(0).max(1),
    capabilityMatch: z.number().min(0).max(1),
  }),
  weightedTotal: z.number().min(0),
  ownershipRecord: z.any().nullable(), // OwnershipRecord | null
  riskFlagCount: z.number().int().min(0),
  capabilityTags: z.array(z.string()),
});

export const TeamRecommendationSchema = z.object({
  rank: z.number().int().min(1).max(3),
  score: z.number().min(0),
  firms: z.array(FirmScoreBreakdownSchema),
  hasPriorPartnerships: z.boolean(),
});

export const RecommendResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    recommendations: z.array(TeamRecommendationSchema).min(1).max(3),
  }),
  z.object({
    status: z.literal("no_valid_team"),
    reason: z.string(),
    recommendations: z.array(TeamRecommendationSchema).length(0),
  }),
]);

// Inferred types — use these throughout the scorer and UI rather than re-declaring
export type CapabilityMix = z.infer<typeof CapabilityMixSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type RecommendRequest = z.infer<typeof RecommendRequestSchema>;
export type FirmScoreBreakdown = z.infer<typeof FirmScoreBreakdownSchema>;
export type TeamRecommendation = z.infer<typeof TeamRecommendationSchema>;
export type RecommendResponse = z.infer<typeof RecommendResponseSchema>;
