export type TickerClusterCategoryStat = {
  name: string;
  count: number;
  share: number;
};

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
  percolationBridgeAnalyses: TickerSignalCombinationPercolationBridgeAnalysis[];
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

export type TickerSignalCombinationPercolationBridgeAnalysis = {
  lens: "idfWeightedJaccard" | "hamming";
  label: string;
  previousThreshold: number;
  peakThreshold: number;
  peakMoment: number;
  largestBeforeSize: number;
  largestBeforeTickerCount: number;
  largestBeforeTickers?: string[];
  largestAfterPieceCount: number;
  largestAfterSize: number;
  largestAfterTickerCount: number;
  largestAfterTickers?: string[];
  removedEdgeCount: number;
  bridgeEdgeCount: number;
  preBreakBaselineSignals: TickerSignalCombinationFamilySignalSummary[];
  topBridgeSignals: TickerSignalCombinationBridgeSignalSummary[];
  postBreakPieces: TickerSignalCombinationFamilySummary[];
};

export type TickerSignalCombinationBridgeSignalSummary = {
  signal: TickerSignalCombinationSignal;
  edgeCount: number;
  share: number;
  baselineShare: number;
  lift: number | null;
  averageSimilarity: number;
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
  marketAudit?: TickerSignalCombinationMarketAudit;
  hammingAudit?: TickerSignalCombinationHammingAudit;
  featureAudit?: TickerSignalCombinationFeatureAudit;
};

export type TickerSignalCombinationMarketAudit = {
  totalMarketCap: number | null;
  medianMarketCap: number | null;
  sectorStats: TickerClusterCategoryStat[];
  industryStats: TickerClusterCategoryStat[];
  universeOverlaps: TickerSignalCombinationUniverseOverlap[];
  topMembers: TickerSignalCombinationMember[];
};

export type TickerSignalCombinationUniverseOverlap = {
  universeKey: string;
  universeLabel: string;
  count: number;
  share: number;
};

export type TickerSignalCombinationFeatureAudit = {
  baselineTickerCount: number;
  pieceTickerCount: number;
  topFeatures: TickerSignalCombinationFeatureContrast[];
};

export type TickerSignalCombinationFeatureContrast = {
  featureToken: string;
  factor: string;
  axis: string;
  metricKey: string;
  featureKey: string;
  pieceCoverage: number;
  baselineCoverage: number;
  pieceMedian: number;
  baselineMedian: number;
  delta: number;
  robustDelta: number | null;
};

export type TickerSignalCombinationHammingAudit = {
  threshold: number;
  averageSimilarity: number | null;
  subclusterCount: number;
  largestSubclusterSize: number;
  largestSubclusterShare: number;
  singletonSubclusterCount: number;
  stateDiversity: TickerSignalCombinationStateDiversity[];
};

export type TickerSignalCombinationStateDiversity = {
  factorAxis: string;
  dominantState: string;
  dominantShare: number;
  distinctStateCount: number;
};

export type TickerSignalCombinationFamilySignalSummary = {
  signal: TickerSignalCombinationSignal;
  groupCount: number;
  tickerCount: number;
  share: number;
  groupShare: number;
  baselineShare?: number;
  lift?: number | null;
  contrastShare?: number;
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
