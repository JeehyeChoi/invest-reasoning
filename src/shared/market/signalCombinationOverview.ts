import type { TickerClusterCategoryStat } from "@/shared/market/clusterOverview";

export type TickerSignalCombinationOverview = {
  asOfDate: string | null;
  tickerCount: number;
  signalDimensionCount: number;
  factorAxisCount: number;
  groupCount: number;
  hammingSimilarityDistribution: TickerSignalCombinationSimilarityBucket[];
  thresholdStats: TickerSignalCombinationThresholdStat[];
  thresholdCandidates: TickerSignalCombinationThresholdCandidate[];
  idfWeightedJaccardThresholdStats: TickerSignalCombinationThresholdStat[];
  idfWeightedJaccardThresholdCandidates: TickerSignalCombinationThresholdCandidate[];
  hammingThresholdStats: TickerSignalCombinationThresholdStat[];
  hammingThresholdCandidates: TickerSignalCombinationThresholdCandidate[];
  partitionAgreement: TickerSignalCombinationPartitionAgreement;
  idfWeightedPartitionAgreement: TickerSignalCombinationPartitionAgreement;
  communityAnalyses: TickerSignalCombinationCommunityAnalysis[];
  groups: TickerSignalCombinationGroup[];
  unavailableReason?: string;
};

export type TickerSignalCombinationThresholdStat = {
  threshold: number;
  familyCount: number;
  largestFamilySize: number;
  secondLargestFamilySize: number;
  singletonFamilyCount: number;
  finiteClusterSecondMoment: number;
  finiteClusterMeanSize: number;
};

export type TickerSignalCombinationSimilarityBucket = {
  minSimilarity: number;
  maxSimilarity: number;
  pairCount: number;
  share: number;
};

export type TickerSignalCombinationPartitionAgreement = {
  jaccardThresholds: number[];
  hammingThresholds: number[];
  cells: TickerSignalCombinationPartitionAgreementCell[];
  bestCell: TickerSignalCombinationPartitionAgreementCell | null;
  bestMatchedFamilies: TickerSignalCombinationMatchedFamily[];
};

export type TickerSignalCombinationPartitionAgreementCell = {
  jaccardThreshold: number;
  hammingThreshold: number;
  adjustedRandIndex: number;
  jaccardFamilyCount: number;
  hammingFamilyCount: number;
  jaccardLargestFamilySize: number;
  hammingLargestFamilySize: number;
  jaccardSingletonFamilyCount: number;
  hammingSingletonFamilyCount: number;
};

export type TickerSignalCombinationMatchedFamily = {
  rank: number;
  jaccardFamilyId: number;
  hammingFamilyId: number;
  overlapGroupCount: number;
  jaccardGroupCount: number;
  hammingGroupCount: number;
  overlapShareOfJaccard: number;
  overlapShareOfHamming: number;
  overlapJaccard: number;
  overlapTickerCount: number;
  topSignals: TickerSignalCombinationFamilySignalSummary[];
  topMembers: TickerSignalCombinationMember[];
};

export type TickerSignalCombinationCommunityAnalysis = {
  method: "louvain" | "infomap" | "mcl";
  label: string;
  description: string;
  graphSource: string;
  nodeCount: number;
  edgeCount: number;
  communityCount: number;
  largestCommunitySize: number;
  singletonCommunityCount: number;
  modularity: number | null;
  communities: TickerSignalCombinationCommunitySummary[];
};

export type TickerSignalCombinationCommunitySummary = {
  communityId: number;
  groupCount: number;
  tickerCount: number;
  internalEdgeWeight: number;
  edgeDensity: number;
  topSignals: TickerSignalCombinationFamilySignalSummary[];
  topMembers: TickerSignalCombinationMember[];
  sectorStats: TickerClusterCategoryStat[];
  industryStats: TickerClusterCategoryStat[];
};

export type TickerSignalCombinationThresholdCandidate = {
  kind: "secondary_emergence" | "secondary_disappearance" | "giant_collapse";
  label: string;
  threshold: number;
  familyCount: number;
  largestFamilySize: number;
  secondLargestFamilySize: number;
  singletonFamilyCount: number;
  topFamilies: TickerSignalCombinationFamilySummary[];
};

export type TickerSignalCombinationFamilySummary = {
  familyId: number;
  groupCount: number;
  tickerCount: number;
  topSignals: TickerSignalCombinationFamilySignalSummary[];
  sampleGroups: TickerSignalCombinationFamilyGroupSummary[];
};

export type TickerSignalCombinationFamilySignalSummary = {
  signal: TickerSignalCombinationSignal;
  groupCount: number;
  share: number;
};

export type TickerSignalCombinationFamilyGroupSummary = {
  groupId: number;
  combinationKey: string;
  tickerCount: number;
  activeSignalCount: number;
};

export type TickerSignalCombinationGroup = {
  groupId: number;
  combinationKey: string;
  tickerCount: number;
  activeSignalCount: number;
  hammingStateCount: number;
  activeSignals: TickerSignalCombinationSignal[];
  nearestGroups: TickerSignalCombinationNearestGroup[];
  sectorStats: TickerClusterCategoryStat[];
  industryStats: TickerClusterCategoryStat[];
  members: TickerSignalCombinationMember[];
};

export type TickerSignalCombinationNearestGroup = {
  groupId: number;
  combinationKey: string;
  tickerCount: number;
  activeSignalCount: number;
  hammingSimilarity: number;
  hammingDistance: number;
  differentStateCount: number;
  comparedStateCount: number;
  sharedSignalCount: number;
  unionSignalCount: number;
  jaccardSimilarity: number;
  jaccardDistance: number;
  differingSignalCount: number;
  sharedSignals: TickerSignalCombinationSignal[];
};

export type TickerSignalCombinationSignal = {
  factor: string;
  axis: string;
  signalKey: string;
  signalLabel: string | null;
  token: string;
};

export type TickerSignalCombinationMember = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
};
