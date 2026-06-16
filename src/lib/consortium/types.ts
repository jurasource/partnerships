export type ConsortiumFirmContext = {
  id: string;
  canonicalName: string;
  capabilityTags: string[];
  ownership: {
    ukIncorporated: "yes" | "no" | "unknown";
    ultimateParent: string | null;
    countryOfOwnership: string | null;
  } | null;
  riskFlags: {
    flagType: string;
    severity: string;
    description: string;
  }[];
  partnerships: {
    partnerFirmName: string;
    partnershipType: string;
    evidenceSummary: string;
    evidenceDate: string | null;
  }[];
  conflicts: {
    otherFirmName: string;
    conflictType: string;
    evidenceSummary: string;
  }[];
  findings: {
    topicName: string;
    summary: string;
    sourceTitle: string;
    sourceUrl: string;
  }[];
};

export type ConsortiumPromptInput = {
  opportunity: {
    name: string;
    description: string;
  };
  capabilityMix: {
    Consultancy: number;
    Infrastructure: number;
    Nuclear: number;
  };
  constraints: {
    ukOwned: boolean;
    noHighRisk: boolean;
    priorNuclear: boolean;
    freeText: string;
  };
  firms: ConsortiumFirmContext[];
  include: {
    findings: boolean;
    riskFlags: boolean;
    partnerships: boolean;
    ownership: boolean;
  };
};

export type ConsortiumSuggestion = {
  name: string;
  firms: { name: string; role: string }[];
  rationale: string;
  risks: string;
  scores: {
    capability: number;
    ukOwnership: number;
    riskProfile: number;
    partnershipEvidence: number;
  };
};
