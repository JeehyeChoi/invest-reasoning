import { createHash } from "crypto";
import { db } from "@/backend/config/db";
import {
  SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS,
  type SignalTimelineAxisScope,
} from "@/shared/market/signalCombinationTimeline";
import { UNIVERSE_LABELS } from "@/shared/universe/universes";
import type {
  TickerClusterCategoryStat,
  TickerSignalCombinationFeatureAudit,
  TickerSignalCombinationGroup,
  TickerSignalCombinationCommunityAnalysis,
  TickerSignalCombinationFamilySummary,
  TickerSignalCombinationMember,
  TickerSignalCombinationMatchedFamily,
  TickerSignalCombinationNearestGroup,
  TickerSignalCombinationOverview,
  TickerSignalCombinationPercolationBridgeAnalysis,
  TickerSignalCombinationPartitionAgreement,
  TickerSignalCombinationSimilarityBucket,
  TickerSignalCombinationSignal,
  TickerSignalCombinationThresholdCandidate,
  TickerSignalCombinationThresholdStat,
} from "@/shared/market/signalCombinationOverview";

type SignalCombinationRow = {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | string | null;
  factor: string;
  axis: string;
  signal_key: string;
  signal_label: string | null;
  signal_effective_date: Date | string;
};

type FeatureValueRow = {
  ticker: string;
  factor: string;
  axis: string;
  metric_key: string;
  feature_key: string;
  feature_value: number | string | null;
  effective_date: Date | string;
};

type UniverseMembershipRow = {
  ticker: string;
  universe_key: string;
};

export type GetTickerSignalCombinationOverviewInput = {
  asOfDate?: string;
  detailMode?: "full" | "percolation" | "latestFlow";
  axisScope?: SignalTimelineAxisScope;
  includePercolationMemberTickers?: boolean;
};

export async function getTickerSignalCombinationOverview(
  input: GetTickerSignalCombinationOverviewInput = {},
): Promise<TickerSignalCombinationOverview> {
  try {
    const rows = await loadLatestSignalRows(input);

    if (rows.length === 0) {
      return {
        asOfDate: input.asOfDate ?? null,
        tickerCount: 0,
        signalDimensionCount: 0,
        factorAxisCount: 0,
        groupCount: 0,
        hammingSimilarityDistribution: [],
        thresholdStats: [],
        thresholdCandidates: [],
        idfWeightedJaccardThresholdStats: [],
        idfWeightedJaccardThresholdCandidates: [],
        hammingThresholdStats: [],
        hammingThresholdCandidates: [],
        partitionAgreement: {
          jaccardThresholds: [],
          hammingThresholds: [],
          cells: [],
          bestCell: null,
          bestMatchedFamilies: [],
        },
        idfWeightedPartitionAgreement: {
          jaccardThresholds: [],
          hammingThresholds: [],
          cells: [],
          bestCell: null,
          bestMatchedFamilies: [],
        },
        percolationBridgeAnalyses: [],
        communityAnalyses: [],
        groups: [],
      };
    }

    const featureRows =
      input.detailMode === "latestFlow"
        ? []
        : await loadLatestFeatureValueRows(input, [
            ...new Set(rows.map((row) => row.ticker)),
          ]);
    const universeRows =
      input.detailMode === "latestFlow"
        ? []
        : await loadUniverseMembershipRows([
            ...new Set(rows.map((row) => row.ticker)),
          ]);

    if (rows.length === 0) {
      return {
        asOfDate: input.asOfDate ?? null,
        tickerCount: 0,
        signalDimensionCount: 0,
        factorAxisCount: 0,
        groupCount: 0,
        hammingSimilarityDistribution: [],
        thresholdStats: [],
        thresholdCandidates: [],
        idfWeightedJaccardThresholdStats: [],
        idfWeightedJaccardThresholdCandidates: [],
        hammingThresholdStats: [],
        hammingThresholdCandidates: [],
        partitionAgreement: {
          jaccardThresholds: [],
          hammingThresholds: [],
          cells: [],
          bestCell: null,
          bestMatchedFamilies: [],
        },
        idfWeightedPartitionAgreement: {
          jaccardThresholds: [],
          hammingThresholds: [],
          cells: [],
          bestCell: null,
          bestMatchedFamilies: [],
        },
        percolationBridgeAnalyses: [],
        communityAnalyses: [],
        groups: [],
      };
    }

    return buildOverview(rows, input, featureRows, universeRows);
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        asOfDate: input.asOfDate ?? null,
        tickerCount: 0,
        signalDimensionCount: 0,
        factorAxisCount: 0,
        groupCount: 0,
        hammingSimilarityDistribution: [],
        thresholdStats: [],
        thresholdCandidates: [],
        idfWeightedJaccardThresholdStats: [],
        idfWeightedJaccardThresholdCandidates: [],
        hammingThresholdStats: [],
        hammingThresholdCandidates: [],
        partitionAgreement: {
          jaccardThresholds: [],
          hammingThresholds: [],
          cells: [],
          bestCell: null,
          bestMatchedFamilies: [],
        },
        idfWeightedPartitionAgreement: {
          jaccardThresholds: [],
          hammingThresholds: [],
          cells: [],
          bestCell: null,
          bestMatchedFamilies: [],
        },
        percolationBridgeAnalyses: [],
        communityAnalyses: [],
        groups: [],
        unavailableReason:
          "Signal tables are not available yet. Apply ticker factor signal storage and run the signal workflow.",
      };
    }

    throw error;
  }
}

async function loadLatestSignalRows(
  input: GetTickerSignalCombinationOverviewInput,
): Promise<SignalCombinationRow[]> {
  const result = await db.query<SignalCombinationRow>(
    `
      WITH latest_signals AS (
        SELECT DISTINCT ON (
          s.ticker,
          s.factor,
          s.axis
        )
          s.ticker,
          s.factor,
          s.axis,
          s.signal_key,
          s.signal_label,
          s.signal_effective_date
        FROM public.ticker_factor_signals s
        JOIN public.ticker_signal_clustering_question_policies qp
          ON qp.model_key = s.model_key
         AND qp.model_version = s.model_version
         AND qp.factor = s.factor
         AND qp.axis = s.axis
         AND qp.is_active = true
         AND qp.status IN ('use', 'review')
        WHERE s.model_key = 'factor_signal'
          AND s.model_version = 'v0'
          AND ($1::date IS NULL OR s.signal_effective_date <= $1)
          AND (
            cardinality($2::text[]) = 0
            OR s.axis = ANY($2::text[])
          )
          AND s.signal_key IS NOT NULL
        ORDER BY
          s.ticker,
          s.factor,
          s.axis,
          s.signal_effective_date DESC,
          s.signal_period_end DESC
      )
      SELECT
        s.ticker,
        p.company_name,
        c.sector,
        c.industry,
        m.market_cap,
        s.factor,
        s.axis,
        s.signal_key,
        s.signal_label,
        s.signal_effective_date
      FROM latest_signals s
      LEFT JOIN public.ticker_identities p
        ON p.ticker = s.ticker
      LEFT JOIN public.ticker_company_classifications c
        ON c.ticker = s.ticker
      LEFT JOIN public.ticker_market_snapshots m
        ON m.ticker = s.ticker
      ORDER BY
        s.ticker,
        s.factor,
        s.axis,
        s.signal_key
    `,
    [input.asOfDate ?? null, resolveAxisFilter(input.axisScope)],
  );

  return result.rows;
}

const MARKET_AUDIT_UNIVERSE_KEYS = [
  "sp500",
  "sp400",
  "sp600",
] as const;

async function loadUniverseMembershipRows(
  tickers: string[],
): Promise<UniverseMembershipRow[]> {
  if (tickers.length === 0) return [];

  const result = await db.query<UniverseMembershipRow>(
    `
      SELECT
        ticker,
        universe_key
      FROM public.universe_memberships
      WHERE ticker = ANY($1::text[])
        AND universe_key = ANY($2::text[])
        AND is_active = true
      ORDER BY
        ticker,
        universe_key
    `,
    [tickers, [...MARKET_AUDIT_UNIVERSE_KEYS]],
  );

  return result.rows;
}

async function loadLatestFeatureValueRows(
  input: GetTickerSignalCombinationOverviewInput,
  tickers: string[],
): Promise<FeatureValueRow[]> {
  if (tickers.length === 0) return [];

  const result = await db.query<FeatureValueRow>(
    `
      SELECT DISTINCT ON (
        f.ticker,
        f.factor,
        f.axis,
        f.metric_key,
        f.feature_key
      )
        f.ticker,
        f.factor,
        f.axis,
        f.metric_key,
        f.feature_key,
        f.feature_value,
        f.effective_date
      FROM public.ticker_factor_metric_features f
      JOIN public.ticker_signal_clustering_question_policies qp
        ON qp.model_key = 'factor_signal'
       AND qp.model_version = 'v0'
       AND qp.factor = f.factor
       AND qp.axis = f.axis
       AND qp.is_active = true
       AND qp.status IN ('use', 'review')
      WHERE f.ticker = ANY($1::text[])
        AND ($2::date IS NULL OR f.effective_date <= $2)
        AND (
          cardinality($3::text[]) = 0
          OR f.axis = ANY($3::text[])
        )
        AND f.feature_value IS NOT NULL
      ORDER BY
        f.ticker,
        f.factor,
        f.axis,
        f.metric_key,
        f.feature_key,
        f.effective_date DESC,
        f.period_end DESC
    `,
    [tickers, input.asOfDate ?? null, resolveAxisFilter(input.axisScope)],
  );

  return result.rows;
}

function buildOverview(
  rows: SignalCombinationRow[],
  input: GetTickerSignalCombinationOverviewInput,
  featureRows: FeatureValueRow[] = [],
  universeRows: UniverseMembershipRow[] = [],
): TickerSignalCombinationOverview {
  const tickerGroups = new Map<string, TickerSignalCombinationDraft>();
  const allFactorAxes = new Set<string>();
  const allDirectionalSignalTokens = new Set<string>();
  let asOfDate = input.asOfDate ?? toDateText(rows[0].signal_effective_date);

  for (const row of rows) {
    const token = buildSignalToken(row);
    allFactorAxes.add(`${row.factor}.${row.axis}`);
    if (isDirectionalSignal(row.signal_key)) {
      allDirectionalSignalTokens.add(token);
    }
    asOfDate =
      toDateText(row.signal_effective_date) > asOfDate
        ? toDateText(row.signal_effective_date)
        : asOfDate;

    const tickerGroup =
      tickerGroups.get(row.ticker) ??
      {
        ticker: row.ticker,
        companyName: row.company_name,
        sector: row.sector,
        industry: row.industry,
        marketCap: toNullableNumber(row.market_cap),
        signalsByToken: new Map<string, TickerSignalCombinationSignal>(),
        statesByAxis: new Map<string, string>(),
      };

    const signal = {
      factor: row.factor,
      axis: row.axis,
      signalKey: row.signal_key,
      signalLabel: row.signal_label,
      token,
    };

    if (isDirectionalSignal(row.signal_key)) {
      tickerGroup.signalsByToken.set(token, signal);
    }
    tickerGroup.statesByAxis.set(`${row.factor}.${row.axis}`, row.signal_key);
    tickerGroups.set(row.ticker, tickerGroup);
  }

  const combinationGroups = new Map<string, CombinationGroupDraft>();
  const factorAxisKeys = [...allFactorAxes].sort();

  for (const tickerGroup of tickerGroups.values()) {
    const activeSignals = [...tickerGroup.signalsByToken.values()].sort(
      compareSignals,
    );
    const stateVector = buildStateVector(tickerGroup.statesByAxis, factorAxisKeys);
    const combinationKey = hashCombination(stateVector);
    const group =
      combinationGroups.get(combinationKey) ??
      {
        combinationKey,
        activeSignals,
        stateVector,
        members: [],
        sectorCounts: new Map<string, number>(),
        industryCounts: new Map<string, number>(),
      };

    const member = {
      ticker: tickerGroup.ticker,
      companyName: tickerGroup.companyName,
      sector: tickerGroup.sector,
      industry: tickerGroup.industry,
      marketCap: tickerGroup.marketCap,
    };

    group.members.push(member);
    incrementCount(group.sectorCounts, member.sector ?? "Unclassified");
    incrementCount(group.industryCounts, member.industry ?? "Unclassified");
    combinationGroups.set(combinationKey, group);
  }

  const sortedGroupDrafts = [...combinationGroups.values()]
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        b.activeSignals.length - a.activeSignals.length ||
        a.combinationKey.localeCompare(b.combinationKey),
    );
  const groupIdsByKey = new Map(
    sortedGroupDrafts.map((group, index) => [group.combinationKey, index + 1]),
  );
  const signalWeights = buildSignalWeights(sortedGroupDrafts);
  const pairwiseSimilarities = buildPairwiseSimilarities(
    sortedGroupDrafts,
    signalWeights,
  );
  const featureMatrix = buildFeatureMatrix(featureRows);
  const universeMembershipsByTicker = buildUniverseMembershipsByTicker(universeRows);
  const idfWeightedJaccardThresholdStats = buildThresholdStats(
    sortedGroupDrafts,
    pairwiseSimilarities,
    "idfWeightedJaccard",
  );
  if (input.detailMode === "latestFlow") {
    const percolationBridgeAnalyses = buildPercolationBridgeAnalyses({
      groups: sortedGroupDrafts,
      groupIdsByKey,
      pairwiseSimilarities,
      idfWeightedJaccardThresholdStats,
      hammingThresholdStats: [],
      featureMatrix,
      universeMembershipsByTicker,
      includeAudits: false,
      includeMemberTickers: input.includePercolationMemberTickers,
    });

    return {
      asOfDate,
      tickerCount: tickerGroups.size,
      signalDimensionCount: allDirectionalSignalTokens.size,
      factorAxisCount: factorAxisKeys.length,
      groupCount: sortedGroupDrafts.length,
      hammingSimilarityDistribution: [],
      thresholdStats: [],
      thresholdCandidates: [],
      idfWeightedJaccardThresholdStats,
      idfWeightedJaccardThresholdCandidates: [],
      hammingThresholdStats: [],
      hammingThresholdCandidates: [],
      partitionAgreement: {
        jaccardThresholds: [],
        hammingThresholds: [],
        cells: [],
        bestCell: null,
        bestMatchedFamilies: [],
      },
      idfWeightedPartitionAgreement: {
        jaccardThresholds: [],
        hammingThresholds: [],
        cells: [],
        bestCell: null,
        bestMatchedFamilies: [],
      },
      percolationBridgeAnalyses,
      communityAnalyses: [],
      groups: [],
    };
  }

  const hammingThresholdStats = buildThresholdStats(
    sortedGroupDrafts,
    pairwiseSimilarities,
    "hamming",
  );
  const percolationBridgeAnalyses = buildPercolationBridgeAnalyses({
    groups: sortedGroupDrafts,
    groupIdsByKey,
    pairwiseSimilarities,
    idfWeightedJaccardThresholdStats,
    hammingThresholdStats,
    featureMatrix,
    universeMembershipsByTicker,
    includeMemberTickers: input.includePercolationMemberTickers,
  });

  if (input.detailMode === "percolation") {
    return {
      asOfDate,
      tickerCount: tickerGroups.size,
      signalDimensionCount: allDirectionalSignalTokens.size,
      factorAxisCount: factorAxisKeys.length,
      groupCount: sortedGroupDrafts.length,
      hammingSimilarityDistribution: [],
      thresholdStats: [],
      thresholdCandidates: [],
      idfWeightedJaccardThresholdStats,
      idfWeightedJaccardThresholdCandidates: [],
      hammingThresholdStats,
      hammingThresholdCandidates: [],
      partitionAgreement: {
        jaccardThresholds: [],
        hammingThresholds: [],
        cells: [],
        bestCell: null,
        bestMatchedFamilies: [],
      },
      idfWeightedPartitionAgreement: {
        jaccardThresholds: [],
        hammingThresholds: [],
        cells: [],
        bestCell: null,
        bestMatchedFamilies: [],
      },
      percolationBridgeAnalyses,
      communityAnalyses: [],
      groups: [],
    };
  }

  const nearestGroupsByKey = buildNearestGroups(
    sortedGroupDrafts,
    groupIdsByKey,
    pairwiseSimilarities,
  );
  const thresholdStats = buildThresholdStats(
    sortedGroupDrafts,
    pairwiseSimilarities,
  );
  const thresholdCandidates = buildThresholdCandidates({
    groups: sortedGroupDrafts,
    groupIdsByKey,
    pairwiseSimilarities,
    thresholdStats,
    similarity: "jaccard",
  });
  const idfWeightedJaccardThresholdCandidates = buildThresholdCandidates({
    groups: sortedGroupDrafts,
    groupIdsByKey,
    pairwiseSimilarities,
    thresholdStats: idfWeightedJaccardThresholdStats,
    similarity: "idfWeightedJaccard",
  });
  const hammingSimilarities = buildHammingSimilarities(sortedGroupDrafts);
  const hammingSimilarityDistribution =
    buildHammingSimilarityDistribution(hammingSimilarities);
  const hammingThresholdCandidates = buildThresholdCandidates({
    groups: sortedGroupDrafts,
    groupIdsByKey,
    pairwiseSimilarities,
    thresholdStats: hammingThresholdStats,
    similarity: "hamming",
  });
  const partitionAgreement = buildPartitionAgreement({
    groups: sortedGroupDrafts,
    pairwiseSimilarities,
    jaccardThresholds: pickJaccardAgreementThresholds(
      thresholdStats,
      thresholdCandidates.map((candidate) => candidate.threshold),
    ),
    hammingThresholds: pickHammingAgreementThresholds(
      hammingThresholdStats,
      hammingThresholdCandidates.map((candidate) => candidate.threshold),
    ),
  });
  const idfWeightedPartitionAgreement = buildPartitionAgreement({
    groups: sortedGroupDrafts,
    pairwiseSimilarities,
    similarity: "idfWeightedJaccard",
    jaccardThresholds: pickJaccardAgreementThresholds(
      idfWeightedJaccardThresholdStats,
      idfWeightedJaccardThresholdCandidates.map(
        (candidate) => candidate.threshold,
      ),
    ),
    hammingThresholds: pickHammingAgreementThresholds(
      hammingThresholdStats,
      hammingThresholdCandidates.map((candidate) => candidate.threshold),
    ),
  });
  const communityAnalyses = buildCommunityAnalyses({
    groups: sortedGroupDrafts,
    pairwiseSimilarities,
  });
  const groups = sortedGroupDrafts.map<TickerSignalCombinationGroup>(
    (group, index) => {
      const members = group.members.sort(compareMembers);

      return {
        groupId: index + 1,
        combinationKey: group.combinationKey,
        tickerCount: members.length,
        activeSignalCount: group.activeSignals.length,
        hammingStateCount: group.stateVector.length,
        activeSignals: group.activeSignals,
        nearestGroups: nearestGroupsByKey.get(group.combinationKey) ?? [],
        sectorStats: toCategoryStats(group.sectorCounts, members.length, 5),
        industryStats: toCategoryStats(group.industryCounts, members.length, 6),
        members: members.slice(0, 6),
      };
    },
  );

  return {
    asOfDate,
    tickerCount: tickerGroups.size,
    signalDimensionCount: allDirectionalSignalTokens.size,
    factorAxisCount: factorAxisKeys.length,
    groupCount: groups.length,
    hammingSimilarityDistribution,
    thresholdStats,
    thresholdCandidates,
    idfWeightedJaccardThresholdStats,
    idfWeightedJaccardThresholdCandidates,
    hammingThresholdStats,
    hammingThresholdCandidates,
    partitionAgreement,
    idfWeightedPartitionAgreement,
    percolationBridgeAnalyses,
    communityAnalyses,
    groups,
  };
}

function resolveAxisFilter(axisScope: SignalTimelineAxisScope | undefined) {
  const option =
    SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.find(
      (item) => item.key === (axisScope ?? "all"),
    ) ?? SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS[0];

  return option.axes ?? [];
}

type TickerSignalCombinationDraft = TickerSignalCombinationMember & {
  signalsByToken: Map<string, TickerSignalCombinationSignal>;
  statesByAxis: Map<string, string>;
};

type CombinationGroupDraft = {
  combinationKey: string;
  activeSignals: TickerSignalCombinationSignal[];
  stateVector: string[];
  members: TickerSignalCombinationMember[];
  sectorCounts: Map<string, number>;
  industryCounts: Map<string, number>;
};

function buildNearestGroups(
  groups: CombinationGroupDraft[],
  groupIdsByKey: Map<string, number>,
  pairwiseSimilarities: PairwiseSimilarity[],
): Map<string, TickerSignalCombinationNearestGroup[]> {
  const nearestGroupsByKey = new Map<
    string,
    TickerSignalCombinationNearestGroup[]
  >();
  const groupsByKey = new Map(groups.map((group) => [group.combinationKey, group]));

  for (const pair of pairwiseSimilarities) {
    const a = groupsByKey.get(pair.aCombinationKey);
    const b = groupsByKey.get(pair.bCombinationKey);

    if (!a || !b) continue;

    addNearestGroup(nearestGroupsByKey, a.combinationKey, {
      groupId: groupIdsByKey.get(b.combinationKey) ?? 0,
      combinationKey: b.combinationKey,
      tickerCount: b.members.length,
      activeSignalCount: b.activeSignals.length,
      hammingSimilarity: pair.hammingSimilarity,
      hammingDistance: 1 - pair.hammingSimilarity,
      differentStateCount: pair.differentStateCount,
      comparedStateCount: pair.comparedStateCount,
      sharedSignalCount: pair.sharedSignalCount,
      unionSignalCount: pair.unionSignalCount,
      jaccardSimilarity: pair.jaccardSimilarity,
      jaccardDistance: 1 - pair.jaccardSimilarity,
      differingSignalCount: pair.unionSignalCount - pair.sharedSignalCount,
      sharedSignals: pair.sharedSignals,
    });
    addNearestGroup(nearestGroupsByKey, b.combinationKey, {
      groupId: groupIdsByKey.get(a.combinationKey) ?? 0,
      combinationKey: a.combinationKey,
      tickerCount: a.members.length,
      activeSignalCount: a.activeSignals.length,
      hammingSimilarity: pair.hammingSimilarity,
      hammingDistance: 1 - pair.hammingSimilarity,
      differentStateCount: pair.differentStateCount,
      comparedStateCount: pair.comparedStateCount,
      sharedSignalCount: pair.sharedSignalCount,
      unionSignalCount: pair.unionSignalCount,
      jaccardSimilarity: pair.jaccardSimilarity,
      jaccardDistance: 1 - pair.jaccardSimilarity,
      differingSignalCount: pair.unionSignalCount - pair.sharedSignalCount,
      sharedSignals: pair.sharedSignals,
    });
  }

  return nearestGroupsByKey;
}

type PairwiseSimilarity = {
  aCombinationKey: string;
  bCombinationKey: string;
  sharedSignalCount: number;
  unionSignalCount: number;
  jaccardSimilarity: number;
  idfWeightedJaccardSimilarity: number;
  hammingSimilarity: number;
  differentStateCount: number;
  comparedStateCount: number;
  sharedSignals: TickerSignalCombinationSignal[];
};

type SimilarityLens = "jaccard" | "idfWeightedJaccard" | "hamming";

const MAX_SIGNAL_IDF_WEIGHT = 3;

type FeatureValueMatrix = {
  valuesByTicker: Map<string, Map<string, number>>;
  definitionsByToken: Map<
    string,
    {
      factor: string;
      axis: string;
      metricKey: string;
      featureKey: string;
    }
  >;
};

type UniverseMembershipsByTicker = Map<string, Set<string>>;

function buildUniverseMembershipsByTicker(
  rows: UniverseMembershipRow[],
): UniverseMembershipsByTicker {
  const membershipsByTicker = new Map<string, Set<string>>();

  for (const row of rows) {
    const memberships = membershipsByTicker.get(row.ticker) ?? new Set<string>();

    memberships.add(row.universe_key);
    membershipsByTicker.set(row.ticker, memberships);
  }

  return membershipsByTicker;
}

function buildFeatureMatrix(rows: FeatureValueRow[]): FeatureValueMatrix {
  const valuesByTicker = new Map<string, Map<string, number>>();
  const definitionsByToken = new Map<
    string,
    {
      factor: string;
      axis: string;
      metricKey: string;
      featureKey: string;
    }
  >();

  for (const row of rows) {
    const featureValue = toNullableNumber(row.feature_value);
    if (featureValue === null || !Number.isFinite(featureValue)) continue;

    const featureToken = buildFeatureToken(row);
    const tickerValues = valuesByTicker.get(row.ticker) ?? new Map<string, number>();

    tickerValues.set(featureToken, featureValue);
    valuesByTicker.set(row.ticker, tickerValues);
    definitionsByToken.set(featureToken, {
      factor: row.factor,
      axis: row.axis,
      metricKey: row.metric_key,
      featureKey: row.feature_key,
    });
  }

  return {
    valuesByTicker,
    definitionsByToken,
  };
}

function getPairSimilarity(pair: PairwiseSimilarity, similarity: SimilarityLens) {
  if (similarity === "jaccard") return pair.jaccardSimilarity;
  if (similarity === "idfWeightedJaccard") {
    return pair.idfWeightedJaccardSimilarity;
  }
  return pair.hammingSimilarity;
}

function isConnectedAtThreshold(pairSimilarity: number, threshold: number) {
  return pairSimilarity > 0 && pairSimilarity >= threshold;
}

function buildSignalWeights(groups: CombinationGroupDraft[]): Map<string, number> {
  const signalGroupCounts = new Map<string, number>();

  for (const group of groups) {
    for (const signal of group.activeSignals) {
      signalGroupCounts.set(
        signal.token,
        (signalGroupCounts.get(signal.token) ?? 0) + 1,
      );
    }
  }

  return new Map(
    [...signalGroupCounts.entries()].map(([token, count]) => [
      token,
      Math.min(Math.log(1 + groups.length / count), MAX_SIGNAL_IDF_WEIGHT),
    ]),
  );
}

function buildPairwiseSimilarities(
  groups: CombinationGroupDraft[],
  signalWeights: Map<string, number>,
): PairwiseSimilarity[] {
  const signalMapsByKey = new Map(
    groups.map((group) => [
      group.combinationKey,
      new Map(group.activeSignals.map((signal) => [signal.token, signal])),
    ]),
  );
  const pairwiseSimilarities: PairwiseSimilarity[] = [];

  for (let aIndex = 0; aIndex < groups.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < groups.length; bIndex += 1) {
      const a = groups[aIndex];
      const b = groups[bIndex];
      const aSignals = signalMapsByKey.get(a.combinationKey) ?? new Map();
      const bSignals = signalMapsByKey.get(b.combinationKey) ?? new Map();
      const sharedSignals = [...aSignals.entries()]
        .filter(([token]) => bSignals.has(token))
        .map(([, signal]) => signal);
      const sharedSignalCount = sharedSignals.length;
      const unionSignalCount =
        a.activeSignals.length + b.activeSignals.length - sharedSignalCount;
      const unionSignalTokens = new Set([
        ...a.activeSignals.map((signal) => signal.token),
        ...b.activeSignals.map((signal) => signal.token),
      ]);
      const sharedSignalWeight = sharedSignals.reduce(
        (total, signal) => total + (signalWeights.get(signal.token) ?? 1),
        0,
      );
      const unionSignalWeight = [...unionSignalTokens].reduce(
        (total, token) => total + (signalWeights.get(token) ?? 1),
        0,
      );
      const differentStateCount = countDifferentStates(a.stateVector, b.stateVector);
      const comparedStateCount = Math.max(a.stateVector.length, b.stateVector.length);
      const jaccardSimilarity =
        unionSignalCount === 0 ? 0 : sharedSignalCount / unionSignalCount;
      const idfWeightedJaccardSimilarity =
        unionSignalWeight === 0 ? 0 : sharedSignalWeight / unionSignalWeight;

      pairwiseSimilarities.push({
        aCombinationKey: a.combinationKey,
        bCombinationKey: b.combinationKey,
        sharedSignalCount,
        unionSignalCount,
        jaccardSimilarity,
        idfWeightedJaccardSimilarity,
        hammingSimilarity:
          comparedStateCount === 0
            ? 0
            : 1 - differentStateCount / comparedStateCount,
        differentStateCount,
        comparedStateCount,
        sharedSignals,
      });
    }
  }

  return pairwiseSimilarities;
}

type HammingSimilarity = {
  similarity: number;
};

function buildHammingSimilarities(
  groups: CombinationGroupDraft[],
): HammingSimilarity[] {
  const similarities: HammingSimilarity[] = [];

  for (let aIndex = 0; aIndex < groups.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < groups.length; bIndex += 1) {
      const a = groups[aIndex];
      const b = groups[bIndex];
      const comparedStateCount = Math.max(a.stateVector.length, b.stateVector.length);
      const differentStateCount = countDifferentStates(a.stateVector, b.stateVector);

      similarities.push({
        similarity:
          comparedStateCount === 0
            ? 0
            : 1 - differentStateCount / comparedStateCount,
      });
    }
  }

  return similarities;
}

function buildHammingSimilarityDistribution(
  similarities: HammingSimilarity[],
): TickerSignalCombinationSimilarityBucket[] {
  if (similarities.length === 0) return [];

  const bucketCounts = Array.from({ length: 21 }, () => 0);

  for (const item of similarities) {
    const index = Math.min(20, Math.floor(item.similarity * 20));
    bucketCounts[index] += 1;
  }

  return bucketCounts.map((pairCount, index) => ({
    minSimilarity: index / 20,
    maxSimilarity: index === 20 ? 1 : (index + 1) / 20,
    pairCount,
    share: pairCount / similarities.length,
  }));
}

function buildThresholdStats(
  groups: CombinationGroupDraft[],
  pairwiseSimilarities: PairwiseSimilarity[],
  similarity: SimilarityLens = "jaccard",
): TickerSignalCombinationThresholdStat[] {
  const groupIndexesByKey = new Map(
    groups.map((group, index) => [group.combinationKey, index]),
  );
  const edgeBuckets = Array.from({ length: 101 }, () => [] as {
    aIndex: number;
    bIndex: number;
  }[]);

  for (const pair of pairwiseSimilarities) {
    const pairSimilarity = getPairSimilarity(pair, similarity);

    if (pairSimilarity <= 0) continue;

    const aIndex = groupIndexesByKey.get(pair.aCombinationKey);
    const bIndex = groupIndexesByKey.get(pair.bCombinationKey);

    if (aIndex === undefined || bIndex === undefined) continue;

    edgeBuckets[Math.min(100, Math.floor(pairSimilarity * 100))].push({
      aIndex,
      bIndex,
    });
  }

  const disjointSet = new DisjointSet(groups.length);
  const statsByThreshold = new Map<number, TickerSignalCombinationThresholdStat>();

  for (let thresholdIndex = 100; thresholdIndex >= 0; thresholdIndex -= 1) {
    const threshold = thresholdIndex / 100;

    for (const edge of edgeBuckets[thresholdIndex]) {
      disjointSet.union(edge.aIndex, edge.bIndex);
    }

    const familySizes = disjointSet.familySizes().sort((a, b) => b - a);
    const finiteFamilySizes = familySizes.slice(1);
    const finiteNodeCount = finiteFamilySizes.reduce(
      (total, size) => total + size,
      0,
    );
    const finiteClusterSecondMoment = finiteFamilySizes.reduce(
      (total, size) => total + size * size,
      0,
    );

    statsByThreshold.set(threshold, {
      threshold,
      familyCount: familySizes.length,
      largestFamilySize: familySizes[0] ?? 0,
      secondLargestFamilySize: familySizes[1] ?? 0,
      singletonFamilyCount: familySizes.filter((size) => size === 1).length,
      finiteClusterSecondMoment,
      finiteClusterMeanSize:
        finiteNodeCount === 0 ? 0 : finiteClusterSecondMoment / finiteNodeCount,
    });
  }

  return Array.from({ length: 101 }, (_, thresholdIndex) => {
    const threshold = thresholdIndex / 100;

    return (
      statsByThreshold.get(threshold) ?? {
        threshold,
        familyCount: groups.length,
        largestFamilySize: groups.length === 0 ? 0 : 1,
        secondLargestFamilySize: groups.length > 1 ? 1 : 0,
        singletonFamilyCount: groups.length,
        finiteClusterSecondMoment: Math.max(0, groups.length - 1),
        finiteClusterMeanSize: groups.length <= 1 ? 0 : 1,
      }
    );
  });
}

function buildPercolationBridgeAnalyses(input: {
  groups: CombinationGroupDraft[];
  groupIdsByKey: Map<string, number>;
  pairwiseSimilarities: PairwiseSimilarity[];
  idfWeightedJaccardThresholdStats: TickerSignalCombinationThresholdStat[];
  hammingThresholdStats: TickerSignalCombinationThresholdStat[];
  featureMatrix: FeatureValueMatrix;
  universeMembershipsByTicker: UniverseMembershipsByTicker;
  includeAudits?: boolean;
  includeMemberTickers?: boolean;
}): TickerSignalCombinationPercolationBridgeAnalysis[] {
  const hammingPeakThreshold =
    [...input.hammingThresholdStats].sort(
      (a, b) => b.finiteClusterMeanSize - a.finiteClusterMeanSize,
    )[0]?.threshold ?? 0.6;
  const firstLargestSplitStat = pickFirstLargestSplitStat(
    input.idfWeightedJaccardThresholdStats,
  );
  const firstLargestSplitAnalysis = firstLargestSplitStat
    ? buildPercolationBridgeAnalysis({
        groups: input.groups,
        groupIdsByKey: input.groupIdsByKey,
        pairwiseSimilarities: input.pairwiseSimilarities,
        thresholdStats: input.idfWeightedJaccardThresholdStats,
        targetStat: firstLargestSplitStat,
        lens: "idfWeightedJaccard",
        label: "IDF Jaccard first largest split",
        hammingAuditThreshold: hammingPeakThreshold,
        featureMatrix: input.featureMatrix,
        universeMembershipsByTicker: input.universeMembershipsByTicker,
        includeAudits: input.includeAudits,
        includeMemberTickers: input.includeMemberTickers,
      })
    : null;
  const idfAnalysis = buildPercolationBridgeAnalysis({
    groups: input.groups,
    groupIdsByKey: input.groupIdsByKey,
    pairwiseSimilarities: input.pairwiseSimilarities,
    thresholdStats: input.idfWeightedJaccardThresholdStats,
    lens: "idfWeightedJaccard",
    label: "IDF Jaccard percolation split",
    hammingAuditThreshold: hammingPeakThreshold,
    featureMatrix: input.featureMatrix,
    universeMembershipsByTicker: input.universeMembershipsByTicker,
    includeAudits: input.includeAudits,
    includeMemberTickers: input.includeMemberTickers,
  });

  return [firstLargestSplitAnalysis, idfAnalysis].filter(
    (analysis): analysis is TickerSignalCombinationPercolationBridgeAnalysis =>
      analysis !== null,
  );
}

function pickFirstLargestSplitStat(
  stats: TickerSignalCombinationThresholdStat[],
) {
  for (let index = 1; index < stats.length; index += 1) {
    const previous = stats[index - 1];
    const current = stats[index];

    if (
      current.largestFamilySize < previous.largestFamilySize &&
      current.secondLargestFamilySize > 0
    ) {
      return current;
    }
  }

  return null;
}

function buildPercolationBridgeAnalysis(input: {
  groups: CombinationGroupDraft[];
  groupIdsByKey: Map<string, number>;
  pairwiseSimilarities: PairwiseSimilarity[];
  thresholdStats: TickerSignalCombinationThresholdStat[];
  targetStat?: TickerSignalCombinationThresholdStat;
  lens: "idfWeightedJaccard" | "hamming";
  label: string;
  hammingAuditThreshold?: number;
  featureMatrix: FeatureValueMatrix;
  universeMembershipsByTicker: UniverseMembershipsByTicker;
  includeAudits?: boolean;
  includeMemberTickers?: boolean;
}): TickerSignalCombinationPercolationBridgeAnalysis | null {
  const peakStat =
    input.targetStat ??
    [...input.thresholdStats].sort(
      (a, b) => b.finiteClusterMeanSize - a.finiteClusterMeanSize,
    )[0];

  if (!peakStat) return null;
  const includeAudits = input.includeAudits ?? true;

  const peakIndex = input.thresholdStats.findIndex(
    (stat) => stat.threshold === peakStat.threshold,
  );
  const previousStat = input.thresholdStats[Math.max(0, peakIndex - 1)] ?? peakStat;
  const beforePartition = buildPartitionAtThreshold({
    groups: input.groups,
    pairwiseSimilarities: input.pairwiseSimilarities,
    threshold: previousStat.threshold,
    similarity: input.lens,
  });
  const afterPartition = buildPartitionAtThreshold({
    groups: input.groups,
    pairwiseSimilarities: input.pairwiseSimilarities,
    threshold: peakStat.threshold,
    similarity: input.lens,
  });
  const beforeLargestFamily = beforePartition.families[0] ?? [];
  const beforeLargestSet = new Set(beforeLargestFamily);
  const afterFamilyIdsByGroupIndex = buildFamilyIdsByGroupIndex(
    afterPartition.families,
  );
  const afterPieceIndexesByFamilyId = new Map<number, number[]>();

  for (const groupIndex of beforeLargestFamily) {
    const familyId = afterFamilyIdsByGroupIndex.get(groupIndex);

    if (!familyId) continue;

    const indexes = afterPieceIndexesByFamilyId.get(familyId) ?? [];
    indexes.push(groupIndex);
    afterPieceIndexesByFamilyId.set(familyId, indexes);
  }

  if (beforeLargestFamily.length <= 1 || afterPieceIndexesByFamilyId.size <= 1) {
    return null;
  }

  const groupIndexesByKey = new Map(
    input.groups.map((group, index) => [group.combinationKey, index]),
  );
  const removedEdges = input.pairwiseSimilarities.filter((pair) => {
    const similarity = getPairSimilarity(pair, input.lens);
    return (
      similarity > 0 &&
      similarity >= previousStat.threshold &&
      similarity < peakStat.threshold
    );
  });
  const bridgeEdges = removedEdges.filter((pair) => {
    const aIndex = groupIndexesByKey.get(pair.aCombinationKey);
    const bIndex = groupIndexesByKey.get(pair.bCombinationKey);

    if (aIndex === undefined || bIndex === undefined) return false;
    if (!beforeLargestSet.has(aIndex) || !beforeLargestSet.has(bIndex)) {
      return false;
    }

    return (
      afterFamilyIdsByGroupIndex.get(aIndex) !==
      afterFamilyIdsByGroupIndex.get(bIndex)
    );
  });
  const signalEdgeCounts = new Map<
    string,
    {
      signal: TickerSignalCombinationSignal;
      edgeCount: number;
      similarityTotal: number;
    }
  >();

  for (const edge of bridgeEdges) {
    const similarity = getPairSimilarity(edge, input.lens);

    for (const signal of edge.sharedSignals) {
      const current = signalEdgeCounts.get(signal.token) ?? {
        signal,
        edgeCount: 0,
        similarityTotal: 0,
      };
      current.edgeCount += 1;
      current.similarityTotal += similarity;
      signalEdgeCounts.set(signal.token, current);
    }
  }

  const preBreakBaselineSignals = buildTopSignalsForGroupIndexes(
    input.groups,
    beforeLargestFamily,
  );
  const largestBeforeTickerCount = countTickersForGroupIndexes(
    input.groups,
    beforeLargestFamily,
  );
  const largestBeforeTickers = input.includeMemberTickers
    ? getTickersForGroupIndexes(input.groups, beforeLargestFamily)
    : undefined;
  const baselineSharesByToken = buildSignalShareMapForGroupIndexes(
    input.groups,
    beforeLargestFamily,
  );
  const postBreakPieces = [...afterPieceIndexesByFamilyId.values()]
    .sort((a, b) => b.length - a.length || a[0] - b[0])
    .map((groupIndexes, index) => ({
      ...buildFamilySummary(groupIndexes, input),
      familyId: index + 1,
    }));
  const postBreakSignalSharesByPiece = [...afterPieceIndexesByFamilyId.values()]
    .sort((a, b) => b.length - a.length || a[0] - b[0])
    .map((groupIndexes) =>
      buildSignalShareMapForGroupIndexes(input.groups, groupIndexes),
    );
  const meaningfulPieceSize = Math.max(
    10,
    Math.ceil(beforeLargestFamily.length * 0.02),
  );
  const majorPieceIndexes = postBreakPieces
    .map((piece, index) => ({ index, groupCount: piece.groupCount }))
    .filter((piece) => piece.groupCount >= meaningfulPieceSize)
    .map((piece) => piece.index);
  const enrichedPostBreakPieces = postBreakPieces
    .slice(0, 4)
    .map((piece, pieceIndex) => ({
      ...piece,
      topSignals: piece.topSignals.map((item) => {
        const baselineShare = baselineSharesByToken.get(item.signal.token) ?? 0;
        const otherPieceShare = Math.max(
          0,
          ...majorPieceIndexes
            .filter((index) => index !== pieceIndex)
            .map(
              (index) =>
                postBreakSignalSharesByPiece[index]?.get(item.signal.token) ?? 0,
            ),
        );

        return {
          ...item,
          baselineShare,
          lift: baselineShare === 0 ? null : item.share / baselineShare,
          contrastShare: item.share - otherPieceShare,
        };
      }),
      hammingAudit:
        !includeAudits || input.hammingAuditThreshold === undefined
          ? undefined
          : buildHammingAuditForGroupIndexes({
              groups: input.groups,
              pairwiseSimilarities: input.pairwiseSimilarities,
              groupIndexes:
                [...afterPieceIndexesByFamilyId.values()].sort(
                  (a, b) => b.length - a.length || a[0] - b[0],
                )[pieceIndex] ?? [],
              threshold: input.hammingAuditThreshold,
            }),
      featureAudit: includeAudits
        ? buildFeatureAuditForGroupIndexes({
            groups: input.groups,
            baselineGroupIndexes: beforeLargestFamily,
            pieceGroupIndexes:
              [...afterPieceIndexesByFamilyId.values()].sort(
                (a, b) => b.length - a.length || a[0] - b[0],
              )[pieceIndex] ?? [],
            featureMatrix: input.featureMatrix,
          })
        : undefined,
      marketAudit: includeAudits
        ? buildMarketAuditForGroupIndexes({
            groups: input.groups,
            groupIndexes:
              [...afterPieceIndexesByFamilyId.values()].sort(
                (a, b) => b.length - a.length || a[0] - b[0],
              )[pieceIndex] ?? [],
            universeMembershipsByTicker: input.universeMembershipsByTicker,
          })
        : undefined,
    }));

  return {
    lens: input.lens,
    label: input.label,
    previousThreshold: previousStat.threshold,
    peakThreshold: peakStat.threshold,
    peakMoment: peakStat.finiteClusterMeanSize,
    largestBeforeSize: beforeLargestFamily.length,
    largestBeforeTickerCount,
    ...(largestBeforeTickers ? { largestBeforeTickers } : {}),
    largestAfterPieceCount: afterPieceIndexesByFamilyId.size,
    largestAfterSize: enrichedPostBreakPieces[0]?.groupCount ?? 0,
    largestAfterTickerCount: enrichedPostBreakPieces[0]?.tickerCount ?? 0,
    ...(input.includeMemberTickers
      ? {
          largestAfterTickers: getTickersForGroupIndexes(
            input.groups,
            [...afterPieceIndexesByFamilyId.values()].sort(
              (a, b) => b.length - a.length || a[0] - b[0],
            )[0] ?? [],
          ),
        }
      : {}),
    removedEdgeCount: removedEdges.length,
    bridgeEdgeCount: bridgeEdges.length,
    preBreakBaselineSignals,
    topBridgeSignals: [...signalEdgeCounts.values()]
      .sort(
        (a, b) =>
          b.edgeCount - a.edgeCount ||
          b.similarityTotal - a.similarityTotal ||
          a.signal.token.localeCompare(b.signal.token),
      )
      .slice(0, 8)
      .map((item) => {
        const share =
          bridgeEdges.length === 0 ? 0 : item.edgeCount / bridgeEdges.length;
        const baselineShare = baselineSharesByToken.get(item.signal.token) ?? 0;

        return {
          signal: item.signal,
          edgeCount: item.edgeCount,
          share,
          baselineShare,
          lift: baselineShare === 0 ? null : share / baselineShare,
          averageSimilarity:
            item.edgeCount === 0 ? 0 : item.similarityTotal / item.edgeCount,
        };
      }),
    postBreakPieces: enrichedPostBreakPieces,
  };
}

function buildHammingAuditForGroupIndexes(input: {
  groups: CombinationGroupDraft[];
  pairwiseSimilarities: PairwiseSimilarity[];
  groupIndexes: number[];
  threshold: number;
}) {
  if (input.groupIndexes.length === 0) {
    return {
      threshold: input.threshold,
      averageSimilarity: null,
      subclusterCount: 0,
      largestSubclusterSize: 0,
      largestSubclusterShare: 0,
      singletonSubclusterCount: 0,
      stateDiversity: [],
    };
  }

  const globalToLocalIndex = new Map(
    input.groupIndexes.map((groupIndex, localIndex) => [groupIndex, localIndex]),
  );
  const groupIndexesByKey = new Map(
    input.groups.map((group, index) => [group.combinationKey, index]),
  );
  const disjointSet = new DisjointSet(input.groupIndexes.length);
  let similarityTotal = 0;
  let similarityPairCount = 0;

  for (const pair of input.pairwiseSimilarities) {
    const aGlobalIndex = groupIndexesByKey.get(pair.aCombinationKey);
    const bGlobalIndex = groupIndexesByKey.get(pair.bCombinationKey);

    if (aGlobalIndex === undefined || bGlobalIndex === undefined) continue;

    const aLocalIndex = globalToLocalIndex.get(aGlobalIndex);
    const bLocalIndex = globalToLocalIndex.get(bGlobalIndex);

    if (aLocalIndex === undefined || bLocalIndex === undefined) continue;

    similarityTotal += pair.hammingSimilarity;
    similarityPairCount += 1;

    if (pair.hammingSimilarity >= input.threshold) {
      disjointSet.union(aLocalIndex, bLocalIndex);
    }
  }

  const subclusterSizes = disjointSet.familySizes().sort((a, b) => b - a);

  return {
    threshold: input.threshold,
    averageSimilarity:
      similarityPairCount === 0 ? null : similarityTotal / similarityPairCount,
    subclusterCount: subclusterSizes.length,
    largestSubclusterSize: subclusterSizes[0] ?? 0,
    largestSubclusterShare:
      input.groupIndexes.length === 0
        ? 0
        : (subclusterSizes[0] ?? 0) / input.groupIndexes.length,
    singletonSubclusterCount: subclusterSizes.filter((size) => size === 1).length,
    stateDiversity: buildStateDiversity(input.groups, input.groupIndexes),
  };
}

function buildFeatureAuditForGroupIndexes(input: {
  groups: CombinationGroupDraft[];
  baselineGroupIndexes: number[];
  pieceGroupIndexes: number[];
  featureMatrix: FeatureValueMatrix;
}): TickerSignalCombinationFeatureAudit | undefined {
  if (
    input.featureMatrix.valuesByTicker.size === 0 ||
    input.baselineGroupIndexes.length === 0 ||
    input.pieceGroupIndexes.length === 0
  ) {
    return undefined;
  }

  const baselineTickers = getTickersForGroupIndexes(
    input.groups,
    input.baselineGroupIndexes,
  );
  const pieceTickers = getTickersForGroupIndexes(
    input.groups,
    input.pieceGroupIndexes,
  );
  const baselineStats = buildFeatureStatsForTickers(
    baselineTickers,
    input.featureMatrix,
  );
  const pieceStats = buildFeatureStatsForTickers(
    pieceTickers,
    input.featureMatrix,
  );
  const minPieceCoverage = pieceTickers.length < 20 ? 0.4 : 0.2;
  const minBaselineCoverage = 0.1;
  const topFeatures = [...pieceStats.entries()]
    .map(([featureToken, pieceStat]) => {
      const baselineStat = baselineStats.get(featureToken);
      const definition = input.featureMatrix.definitionsByToken.get(featureToken);

      if (!baselineStat || !definition) return null;
      if (
        pieceStat.coverage < minPieceCoverage ||
        baselineStat.coverage < minBaselineCoverage
      ) {
        return null;
      }

      const delta = pieceStat.median - baselineStat.median;
      const iqr = baselineStat.q3 - baselineStat.q1;
      const robustDelta = iqr === 0 ? null : delta / iqr;

      if (robustDelta === null || !Number.isFinite(robustDelta)) return null;

      return {
        featureToken,
        factor: definition.factor,
        axis: definition.axis,
        metricKey: definition.metricKey,
        featureKey: definition.featureKey,
        pieceCoverage: pieceStat.coverage,
        baselineCoverage: baselineStat.coverage,
        pieceMedian: pieceStat.median,
        baselineMedian: baselineStat.median,
        delta,
        robustDelta,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort(
      (a, b) =>
        Math.abs(b.robustDelta ?? 0) - Math.abs(a.robustDelta ?? 0) ||
        b.pieceCoverage - a.pieceCoverage ||
        a.featureToken.localeCompare(b.featureToken),
    )
    .slice(0, 5);

  if (topFeatures.length === 0) return undefined;

  return {
    baselineTickerCount: baselineTickers.length,
    pieceTickerCount: pieceTickers.length,
    topFeatures,
  };
}

function buildMarketAuditForGroupIndexes(input: {
  groups: CombinationGroupDraft[];
  groupIndexes: number[];
  universeMembershipsByTicker: UniverseMembershipsByTicker;
}) {
  const members = input.groupIndexes.flatMap(
    (groupIndex) => input.groups[groupIndex].members,
  );

  if (members.length === 0) return undefined;

  const sectorCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();
  const universeCounts = new Map<string, number>();
  const marketCaps = members
    .map((member) => member.marketCap)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);

  for (const member of members) {
    incrementCount(sectorCounts, member.sector ?? "Unclassified");
    incrementCount(industryCounts, member.industry ?? "Unclassified");

    const memberships = input.universeMembershipsByTicker.get(member.ticker);
    if (!memberships) continue;

    for (const universeKey of MARKET_AUDIT_UNIVERSE_KEYS) {
      if (memberships.has(universeKey)) {
        incrementCount(universeCounts, universeKey);
      }
    }
  }

  return {
    totalMarketCap:
      marketCaps.length === 0
        ? null
        : marketCaps.reduce((total, value) => total + value, 0),
    medianMarketCap: marketCaps.length === 0 ? null : quantile(marketCaps, 0.5),
    sectorStats: toCategoryStats(sectorCounts, members.length, 5),
    industryStats: toCategoryStats(industryCounts, members.length, 5),
    universeOverlaps: MARKET_AUDIT_UNIVERSE_KEYS.map((universeKey) => ({
      universeKey,
      universeLabel: UNIVERSE_LABELS[universeKey],
      count: universeCounts.get(universeKey) ?? 0,
      share: members.length === 0 ? 0 : (universeCounts.get(universeKey) ?? 0) / members.length,
    })).filter((overlap) => overlap.count > 0),
    topMembers: members.sort(compareMembers).slice(0, 5),
  };
}

function getTickersForGroupIndexes(
  groups: CombinationGroupDraft[],
  groupIndexes: number[],
) {
  return groupIndexes.flatMap((groupIndex) =>
    groups[groupIndex].members.map((member) => member.ticker),
  );
}

function buildFeatureStatsForTickers(
  tickers: string[],
  featureMatrix: FeatureValueMatrix,
) {
  const valuesByFeature = new Map<string, number[]>();

  for (const ticker of tickers) {
    const tickerValues = featureMatrix.valuesByTicker.get(ticker);
    if (!tickerValues) continue;

    for (const [featureToken, value] of tickerValues.entries()) {
      const values = valuesByFeature.get(featureToken) ?? [];
      values.push(value);
      valuesByFeature.set(featureToken, values);
    }
  }

  return new Map(
    [...valuesByFeature.entries()].map(([featureToken, values]) => {
      const sortedValues = values
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

      return [
        featureToken,
        {
          coverage: tickers.length === 0 ? 0 : sortedValues.length / tickers.length,
          median: quantile(sortedValues, 0.5),
          q1: quantile(sortedValues, 0.25),
          q3: quantile(sortedValues, 0.75),
        },
      ];
    }),
  );
}

function quantile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lowerValue = sortedValues[lowerIndex] ?? sortedValues[0];
  const upperValue = sortedValues[upperIndex] ?? sortedValues[sortedValues.length - 1];
  const weight = index - lowerIndex;

  return lowerValue + (upperValue - lowerValue) * weight;
}

function buildStateDiversity(
  groups: CombinationGroupDraft[],
  groupIndexes: number[],
) {
  const stateCountsByFactorAxis = new Map<string, Map<string, number>>();

  for (const groupIndex of groupIndexes) {
    for (const state of groups[groupIndex].stateVector) {
      const separatorIndex = state.indexOf("=");
      const factorAxis =
        separatorIndex === -1 ? state : state.slice(0, separatorIndex);
      const stateValue =
        separatorIndex === -1 ? "unknown" : state.slice(separatorIndex + 1);
      const stateCounts =
        stateCountsByFactorAxis.get(factorAxis) ?? new Map<string, number>();

      stateCounts.set(stateValue, (stateCounts.get(stateValue) ?? 0) + 1);
      stateCountsByFactorAxis.set(factorAxis, stateCounts);
    }
  }

  return [...stateCountsByFactorAxis.entries()]
    .map(([factorAxis, stateCounts]) => {
      const sortedStates = [...stateCounts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const [dominantState, dominantCount] = sortedStates[0] ?? ["unknown", 0];

      return {
        factorAxis,
        dominantState,
        dominantShare:
          groupIndexes.length === 0 ? 0 : dominantCount / groupIndexes.length,
        distinctStateCount: stateCounts.size,
      };
    })
    .filter((item) => item.distinctStateCount > 1)
    .sort(
      (a, b) =>
        1 - b.dominantShare - (1 - a.dominantShare) ||
        b.distinctStateCount - a.distinctStateCount ||
        a.factorAxis.localeCompare(b.factorAxis),
    )
    .slice(0, 5);
}

type SignalSimilarityGraph = {
  edges: WeightedGraphEdge[];
  adjacency: Map<number, WeightedGraphNeighbor[]>;
};

type WeightedGraphEdge = {
  a: number;
  b: number;
  weight: number;
};

type WeightedGraphNeighbor = {
  index: number;
  weight: number;
};

const COMMUNITY_GRAPH_TOP_K = 14;
const COMMUNITY_GRAPH_MIN_WEIGHT = 0.08;

function buildCommunityAnalyses(input: {
  groups: CombinationGroupDraft[];
  pairwiseSimilarities: PairwiseSimilarity[];
}): TickerSignalCombinationCommunityAnalysis[] {
  const graph = buildSparseSignalSimilarityGraph(input);

  return [
    buildCommunityAnalysis({
      method: "louvain",
      label: "Louvain modularity",
      description:
        "Greedy modularity communities on the sparse capped IDF-weighted signal graph.",
      graphSource: graphSourceLabel(),
      groups: input.groups,
      graph,
      labels: detectLouvainCommunities(input.groups.length, graph),
    }),
    buildCommunityAnalysis({
      method: "infomap",
      label: "Infomap-style flow",
      description:
        "Random-walk label flow on the same weighted graph. This is a local flow proxy for Infomap-style community structure.",
      graphSource: graphSourceLabel(),
      groups: input.groups,
      graph,
      labels: detectFlowCommunities(input.groups.length, graph),
    }),
    buildCommunityAnalysis({
      method: "mcl",
      label: "Markov clustering",
      description:
        "Expansion and inflation on the sparse similarity graph to find compact signal islands.",
      graphSource: graphSourceLabel(),
      groups: input.groups,
      graph,
      labels: detectMarkovCommunities(input.groups.length, graph),
    }),
  ];
}

function graphSourceLabel() {
  return `capped IDF-weighted Jaccard, top ${COMMUNITY_GRAPH_TOP_K} neighbors, min ${COMMUNITY_GRAPH_MIN_WEIGHT.toFixed(2)}`;
}

function buildSparseSignalSimilarityGraph(input: {
  groups: CombinationGroupDraft[];
  pairwiseSimilarities: PairwiseSimilarity[];
}): SignalSimilarityGraph {
  const groupIndexesByKey = new Map(
    input.groups.map((group, index) => [group.combinationKey, index]),
  );
  const candidatesByIndex = new Map<number, WeightedGraphNeighbor[]>();

  for (const pair of input.pairwiseSimilarities) {
    if (pair.idfWeightedJaccardSimilarity < COMMUNITY_GRAPH_MIN_WEIGHT) continue;

    const a = groupIndexesByKey.get(pair.aCombinationKey);
    const b = groupIndexesByKey.get(pair.bCombinationKey);

    if (a === undefined || b === undefined) continue;
    addGraphCandidate(candidatesByIndex, a, {
      index: b,
      weight: pair.idfWeightedJaccardSimilarity,
    });
    addGraphCandidate(candidatesByIndex, b, {
      index: a,
      weight: pair.idfWeightedJaccardSimilarity,
    });
  }

  const edgesByKey = new Map<string, WeightedGraphEdge>();

  for (let index = 0; index < input.groups.length; index += 1) {
    const candidates = (candidatesByIndex.get(index) ?? [])
      .sort((a, b) => b.weight - a.weight || a.index - b.index)
      .slice(0, COMMUNITY_GRAPH_TOP_K);

    for (const candidate of candidates) {
      const a = Math.min(index, candidate.index);
      const b = Math.max(index, candidate.index);
      const key = `${a}:${b}`;
      const existing = edgesByKey.get(key);

      if (!existing || candidate.weight > existing.weight) {
        edgesByKey.set(key, { a, b, weight: candidate.weight });
      }
    }
  }

  const edges = [...edgesByKey.values()].sort(
    (a, b) => b.weight - a.weight || a.a - b.a || a.b - b.b,
  );
  const adjacency = new Map<number, WeightedGraphNeighbor[]>();

  for (const edge of edges) {
    addGraphCandidate(adjacency, edge.a, {
      index: edge.b,
      weight: edge.weight,
    });
    addGraphCandidate(adjacency, edge.b, {
      index: edge.a,
      weight: edge.weight,
    });
  }

  return { edges, adjacency };
}

function addGraphCandidate(
  map: Map<number, WeightedGraphNeighbor[]>,
  index: number,
  candidate: WeightedGraphNeighbor,
) {
  const candidates = map.get(index) ?? [];
  candidates.push(candidate);
  map.set(index, candidates);
}

function detectLouvainCommunities(
  nodeCount: number,
  graph: SignalSimilarityGraph,
): number[] {
  const labels = Array.from({ length: nodeCount }, (_, index) => index);
  const totalWeight = graph.edges.reduce((sum, edge) => sum + edge.weight, 0);
  const degrees = Array.from({ length: nodeCount }, (_, index) =>
    (graph.adjacency.get(index) ?? []).reduce(
      (sum, neighbor) => sum + neighbor.weight,
      0,
    ),
  );
  const communityDegreeSums = new Map(
    degrees.map((degree, index) => [index, degree]),
  );

  if (totalWeight === 0) return labels;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    let moved = false;

    for (let node = 0; node < nodeCount; node += 1) {
      const originalLabel = labels[node];
      const neighbors = graph.adjacency.get(node) ?? [];
      const weightsByCommunity = new Map<number, number>();

      for (const neighbor of neighbors) {
        weightsByCommunity.set(
          labels[neighbor.index],
          (weightsByCommunity.get(labels[neighbor.index]) ?? 0) +
            neighbor.weight,
        );
      }

      const candidateLabels = new Set(weightsByCommunity.keys());
      candidateLabels.add(originalLabel);
      communityDegreeSums.set(
        originalLabel,
        (communityDegreeSums.get(originalLabel) ?? 0) - degrees[node],
      );

      let bestLabel = originalLabel;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const candidateLabel of candidateLabels) {
        const score =
          (weightsByCommunity.get(candidateLabel) ?? 0) -
          (degrees[node] * (communityDegreeSums.get(candidateLabel) ?? 0)) /
            (2 * totalWeight);

        if (score > bestScore || (score === bestScore && candidateLabel < bestLabel)) {
          bestLabel = candidateLabel;
          bestScore = score;
        }
      }

      labels[node] = bestLabel;
      communityDegreeSums.set(
        bestLabel,
        (communityDegreeSums.get(bestLabel) ?? 0) + degrees[node],
      );

      if (bestLabel !== originalLabel) {
        moved = true;
      }
    }

    if (!moved) break;
  }

  return compactLabels(labels);
}

function detectFlowCommunities(
  nodeCount: number,
  graph: SignalSimilarityGraph,
): number[] {
  let labels = Array.from({ length: nodeCount }, (_, index) => index);

  for (let iteration = 0; iteration < 24; iteration += 1) {
    let changed = false;
    const nextLabels = [...labels];

    for (let node = 0; node < nodeCount; node += 1) {
      const scores = new Map<number, number>();

      for (const neighbor of graph.adjacency.get(node) ?? []) {
        scores.set(
          labels[neighbor.index],
          (scores.get(labels[neighbor.index]) ?? 0) + neighbor.weight,
        );
      }

      const currentLabel = labels[node];
      let bestLabel = currentLabel;
      let bestScore = scores.get(currentLabel) ?? 0;

      for (const [label, score] of scores.entries()) {
        if (score > bestScore || (score === bestScore && label < bestLabel)) {
          bestLabel = label;
          bestScore = score;
        }
      }

      nextLabels[node] = bestLabel;
      changed ||= bestLabel !== currentLabel;
    }

    labels = nextLabels;
    if (!changed) break;
  }

  return compactLabels(labels);
}

function detectMarkovCommunities(
  nodeCount: number,
  graph: SignalSimilarityGraph,
): number[] {
  const matrix = new Map<number, Map<number, number>>();

  for (let index = 0; index < nodeCount; index += 1) {
    matrix.set(index, new Map([[index, 1]]));
  }
  for (const edge of graph.edges) {
    matrix.get(edge.a)?.set(edge.b, edge.weight);
    matrix.get(edge.b)?.set(edge.a, edge.weight);
  }
  normalizeRows(matrix);

  let current = matrix;

  for (let iteration = 0; iteration < 14; iteration += 1) {
    current = expandMatrix(current);
    inflateMatrix(current, 1.8);
    pruneMatrix(current, 24, 0.0005);
    normalizeRows(current);
  }

  const labels = Array.from({ length: nodeCount }, (_, index) => {
    const row = current.get(index) ?? new Map([[index, 1]]);
    const best = [...row.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0];

    return best?.[0] ?? index;
  });

  return compactLabels(labels);
}

function expandMatrix(matrix: Map<number, Map<number, number>>) {
  const next = new Map<number, Map<number, number>>();

  for (const [rowIndex, row] of matrix.entries()) {
    const nextRow = new Map<number, number>();

    for (const [middleIndex, rowValue] of row.entries()) {
      const middleRow = matrix.get(middleIndex);

      if (!middleRow) continue;

      for (const [columnIndex, columnValue] of middleRow.entries()) {
        nextRow.set(
          columnIndex,
          (nextRow.get(columnIndex) ?? 0) + rowValue * columnValue,
        );
      }
    }

    next.set(rowIndex, nextRow);
  }

  return next;
}

function inflateMatrix(matrix: Map<number, Map<number, number>>, power: number) {
  for (const row of matrix.values()) {
    for (const [column, value] of row.entries()) {
      row.set(column, value ** power);
    }
  }
}

function pruneMatrix(
  matrix: Map<number, Map<number, number>>,
  limit: number,
  minValue: number,
) {
  for (const [rowIndex, row] of matrix.entries()) {
    matrix.set(
      rowIndex,
      new Map(
        [...row.entries()]
          .filter(([, value]) => value >= minValue)
          .sort((a, b) => b[1] - a[1] || a[0] - b[0])
          .slice(0, limit),
      ),
    );
  }
}

function normalizeRows(matrix: Map<number, Map<number, number>>) {
  for (const row of matrix.values()) {
    const total = [...row.values()].reduce((sum, value) => sum + value, 0);

    if (total === 0) continue;

    for (const [column, value] of row.entries()) {
      row.set(column, value / total);
    }
  }
}

function compactLabels(labels: number[]) {
  const labelsByOriginal = new Map<number, number>();

  return labels.map((label) => {
    const compactLabel = labelsByOriginal.get(label) ?? labelsByOriginal.size;
    labelsByOriginal.set(label, compactLabel);
    return compactLabel;
  });
}

function weightedModularity(labels: number[], graph: SignalSimilarityGraph) {
  const totalWeight = graph.edges.reduce((sum, edge) => sum + edge.weight, 0);

  if (totalWeight === 0) return 0;

  const degrees = new Map<number, number>();
  const internalWeights = new Map<number, number>();
  const degreeSums = new Map<number, number>();

  for (const edge of graph.edges) {
    degrees.set(edge.a, (degrees.get(edge.a) ?? 0) + edge.weight);
    degrees.set(edge.b, (degrees.get(edge.b) ?? 0) + edge.weight);

    if (labels[edge.a] === labels[edge.b]) {
      internalWeights.set(
        labels[edge.a],
        (internalWeights.get(labels[edge.a]) ?? 0) + edge.weight,
      );
    }
  }

  for (let index = 0; index < labels.length; index += 1) {
    degreeSums.set(
      labels[index],
      (degreeSums.get(labels[index]) ?? 0) + (degrees.get(index) ?? 0),
    );
  }

  return [...degreeSums.entries()].reduce((total, [label, degreeSum]) => {
    const internalWeight = internalWeights.get(label) ?? 0;
    return (
      total +
      internalWeight / totalWeight -
      (degreeSum / (2 * totalWeight)) ** 2
    );
  }, 0);
}

function buildCommunityAnalysis(input: {
  method: TickerSignalCombinationCommunityAnalysis["method"];
  label: string;
  description: string;
  graphSource: string;
  groups: CombinationGroupDraft[];
  graph: SignalSimilarityGraph;
  labels: number[];
}): TickerSignalCombinationCommunityAnalysis {
  const communityIndexes = new Map<number, number[]>();

  for (let index = 0; index < input.labels.length; index += 1) {
    const label = input.labels[index];
    const indexes = communityIndexes.get(label) ?? [];
    indexes.push(index);
    communityIndexes.set(label, indexes);
  }

  const communities = [...communityIndexes.values()]
    .sort((a, b) => b.length - a.length || a[0] - b[0])
    .map((indexes, index) =>
      buildCommunitySummary({
        communityId: index + 1,
        groupIndexes: indexes,
        groups: input.groups,
        graph: input.graph,
      }),
    );

  return {
    method: input.method,
    label: input.label,
    description: input.description,
    graphSource: input.graphSource,
    nodeCount: input.groups.length,
    edgeCount: input.graph.edges.length,
    communityCount: communities.length,
    largestCommunitySize: communities[0]?.groupCount ?? 0,
    singletonCommunityCount: communities.filter(
      (community) => community.groupCount === 1,
    ).length,
    modularity: weightedModularity(input.labels, input.graph),
    communities: communities.slice(0, 6),
  };
}

function buildCommunitySummary(input: {
  communityId: number;
  groupIndexes: number[];
  groups: CombinationGroupDraft[];
  graph: SignalSimilarityGraph;
}) {
  const groupIndexSet = new Set(input.groupIndexes);
  const internalEdges = input.graph.edges.filter(
    (edge) => groupIndexSet.has(edge.a) && groupIndexSet.has(edge.b),
  );
  const members = input.groupIndexes.flatMap(
    (groupIndex) => input.groups[groupIndex].members,
  );
  const sectorCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();

  for (const member of members) {
    incrementCount(sectorCounts, member.sector ?? "Unclassified");
    incrementCount(industryCounts, member.industry ?? "Unclassified");
  }

  return {
    communityId: input.communityId,
    groupCount: input.groupIndexes.length,
    tickerCount: members.length,
    internalEdgeWeight: internalEdges.reduce((sum, edge) => sum + edge.weight, 0),
    edgeDensity:
      choose2(input.groupIndexes.length) === 0
        ? 0
        : internalEdges.length / choose2(input.groupIndexes.length),
    topSignals: buildTopSignalsForGroupIndexes(
      input.groups,
      input.groupIndexes,
    ),
    topMembers: members.sort(compareMembers).slice(0, 5),
    sectorStats: toCategoryStats(sectorCounts, members.length, 4),
    industryStats: toCategoryStats(industryCounts, members.length, 4),
  };
}

class DisjointSet {
  private readonly parents: number[];
  private readonly sizes: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index);
    this.sizes = Array.from({ length: size }, () => 1);
  }

  find(value: number): number {
    const parent = this.parents[value];
    if (parent === value) return value;

    const root = this.find(parent);
    this.parents[value] = root;
    return root;
  }

  union(a: number, b: number): void {
    const aRoot = this.find(a);
    const bRoot = this.find(b);

    if (aRoot === bRoot) return;

    if (this.sizes[aRoot] < this.sizes[bRoot]) {
      this.parents[aRoot] = bRoot;
      this.sizes[bRoot] += this.sizes[aRoot];
      return;
    }

    this.parents[bRoot] = aRoot;
    this.sizes[aRoot] += this.sizes[bRoot];
  }

  familySizes(): number[] {
    const counts = new Map<number, number>();

    for (let index = 0; index < this.parents.length; index += 1) {
      const root = this.find(index);
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }

    return [...counts.values()];
  }

  families(): number[][] {
    const familyIndexes = new Map<number, number[]>();

    for (let index = 0; index < this.parents.length; index += 1) {
      const root = this.find(index);
      const indexes = familyIndexes.get(root) ?? [];
      indexes.push(index);
      familyIndexes.set(root, indexes);
    }

    return [...familyIndexes.values()];
  }
}

function buildPartitionAgreement(input: {
  groups: CombinationGroupDraft[];
  pairwiseSimilarities: PairwiseSimilarity[];
  jaccardThresholds: number[];
  hammingThresholds: number[];
  similarity?: Exclude<SimilarityLens, "hamming">;
}): TickerSignalCombinationPartitionAgreement {
  const similarity = input.similarity ?? "jaccard";
  const jaccardThresholds = uniqueSortedThresholds(input.jaccardThresholds);
  const hammingThresholds = uniqueSortedThresholds(input.hammingThresholds);
  const jaccardPartitions = new Map(
    jaccardThresholds.map((threshold) => [
      threshold,
      buildPartitionAtThreshold({
        groups: input.groups,
        pairwiseSimilarities: input.pairwiseSimilarities,
        threshold,
        similarity,
      }),
    ]),
  );
  const hammingPartitions = new Map(
    hammingThresholds.map((threshold) => [
      threshold,
      buildPartitionAtThreshold({
        groups: input.groups,
        pairwiseSimilarities: input.pairwiseSimilarities,
        threshold,
        similarity: "hamming",
      }),
    ]),
  );
  const cells = jaccardThresholds.flatMap((jaccardThreshold) =>
    hammingThresholds.map((hammingThreshold) => {
      const jaccardPartition = jaccardPartitions.get(jaccardThreshold);
      const hammingPartition = hammingPartitions.get(hammingThreshold);

      if (!jaccardPartition || !hammingPartition) {
        return {
          jaccardThreshold,
          hammingThreshold,
          adjustedRandIndex: 0,
          jaccardFamilyCount: 0,
          hammingFamilyCount: 0,
          jaccardLargestFamilySize: 0,
          hammingLargestFamilySize: 0,
          jaccardSingletonFamilyCount: 0,
          hammingSingletonFamilyCount: 0,
        };
      }

      return {
        jaccardThreshold,
        hammingThreshold,
        adjustedRandIndex: adjustedRandIndex(
          jaccardPartition.labels,
          hammingPartition.labels,
        ),
        jaccardFamilyCount: jaccardPartition.familyCount,
        hammingFamilyCount: hammingPartition.familyCount,
        jaccardLargestFamilySize: jaccardPartition.largestFamilySize,
        hammingLargestFamilySize: hammingPartition.largestFamilySize,
        jaccardSingletonFamilyCount: jaccardPartition.singletonFamilyCount,
        hammingSingletonFamilyCount: hammingPartition.singletonFamilyCount,
      };
    }),
  );
  const bestCell =
    [...cells].sort((a, b) => b.adjustedRandIndex - a.adjustedRandIndex)[0] ??
    null;
  const bestJaccardPartition = bestCell
    ? jaccardPartitions.get(bestCell.jaccardThreshold)
    : undefined;
  const bestHammingPartition = bestCell
    ? hammingPartitions.get(bestCell.hammingThreshold)
    : undefined;

  return {
    jaccardThresholds,
    hammingThresholds,
    cells,
    bestCell,
    bestMatchedFamilies:
      bestJaccardPartition && bestHammingPartition
        ? buildMatchedFamilies({
            groups: input.groups,
            jaccardPartition: bestJaccardPartition,
            hammingPartition: bestHammingPartition,
          })
        : [],
  };
}

function pickHammingAgreementThresholds(
  thresholdStats: TickerSignalCombinationThresholdStat[],
  candidateThresholds: number[],
) {
  const changedThresholds = thresholdStats
    .filter((stat, index) => {
      if (stat.threshold < 0.65 || stat.threshold > 0.93) return false;
      const previous = thresholdStats[index - 1];
      if (!previous) return true;

      return (
        stat.familyCount !== previous.familyCount ||
        stat.largestFamilySize !== previous.largestFamilySize ||
        stat.secondLargestFamilySize !== previous.secondLargestFamilySize ||
        stat.singletonFamilyCount !== previous.singletonFamilyCount
      );
    })
    .map((stat) => stat.threshold);

  return uniqueSortedThresholds([...candidateThresholds, ...changedThresholds]);
}

function pickJaccardAgreementThresholds(
  thresholdStats: TickerSignalCombinationThresholdStat[],
  candidateThresholds: number[],
) {
  return uniqueSortedThresholds([
    ...candidateThresholds,
    ...rangeThresholds(0.5, 0.8, 0.02),
  ]).filter((threshold) =>
    thresholdStats.some(
      (stat) => stat.threshold.toFixed(2) === threshold.toFixed(2),
    ),
  );
}

function rangeThresholds(start: number, end: number, step: number) {
  const thresholds: number[] = [];

  for (
    let value = Math.round(start * 100);
    value <= Math.round(end * 100);
    value += Math.round(step * 100)
  ) {
    thresholds.push(value / 100);
  }

  return thresholds;
}

function uniqueSortedThresholds(thresholds: number[]) {
  return [...new Set(thresholds.map((threshold) => Number(threshold.toFixed(2))))]
    .sort((a, b) => a - b);
}

function buildPartitionAtThreshold(input: {
  groups: CombinationGroupDraft[];
  pairwiseSimilarities: PairwiseSimilarity[];
  threshold: number;
  similarity: SimilarityLens;
}) {
  const groupIndexesByKey = new Map(
    input.groups.map((group, index) => [group.combinationKey, index]),
  );
  const disjointSet = new DisjointSet(input.groups.length);

  for (const pair of input.pairwiseSimilarities) {
    const pairSimilarity = getPairSimilarity(pair, input.similarity);

    if (!isConnectedAtThreshold(pairSimilarity, input.threshold)) continue;

    const aIndex = groupIndexesByKey.get(pair.aCombinationKey);
    const bIndex = groupIndexesByKey.get(pair.bCombinationKey);

    if (aIndex === undefined || bIndex === undefined) continue;
    disjointSet.union(aIndex, bIndex);
  }

  const rootToLabel = new Map<number, number>();
  const labels = input.groups.map((_, index) => {
    const root = disjointSet.find(index);
    const label = rootToLabel.get(root) ?? rootToLabel.size;
    rootToLabel.set(root, label);
    return label;
  });
  const familySizes = disjointSet.familySizes().sort((a, b) => b - a);
  const families = disjointSet
    .families()
    .sort((a, b) => b.length - a.length || a[0] - b[0]);

  return {
    labels,
    families,
    familyCount: familySizes.length,
    largestFamilySize: familySizes[0] ?? 0,
    singletonFamilyCount: familySizes.filter((size) => size === 1).length,
  };
}

function buildMatchedFamilies(input: {
  groups: CombinationGroupDraft[];
  jaccardPartition: ReturnType<typeof buildPartitionAtThreshold>;
  hammingPartition: ReturnType<typeof buildPartitionAtThreshold>;
}): TickerSignalCombinationMatchedFamily[] {
  const jaccardFamilyIdsByGroupIndex = buildFamilyIdsByGroupIndex(
    input.jaccardPartition.families,
  );
  const hammingFamilyIdsByGroupIndex = buildFamilyIdsByGroupIndex(
    input.hammingPartition.families,
  );
  const overlapIndexesByPair = new Map<string, number[]>();

  for (let groupIndex = 0; groupIndex < input.groups.length; groupIndex += 1) {
    const jaccardFamilyId = jaccardFamilyIdsByGroupIndex.get(groupIndex);
    const hammingFamilyId = hammingFamilyIdsByGroupIndex.get(groupIndex);

    if (!jaccardFamilyId || !hammingFamilyId) continue;

    const key = `${jaccardFamilyId}:${hammingFamilyId}`;
    const overlapIndexes = overlapIndexesByPair.get(key) ?? [];
    overlapIndexes.push(groupIndex);
    overlapIndexesByPair.set(key, overlapIndexes);
  }

  return [...overlapIndexesByPair.entries()]
    .map(([key, overlapIndexes]) => {
      const [jaccardFamilyIdText, hammingFamilyIdText] = key.split(":");
      const jaccardFamilyId = Number(jaccardFamilyIdText);
      const hammingFamilyId = Number(hammingFamilyIdText);
      const jaccardGroupCount =
        input.jaccardPartition.families[jaccardFamilyId - 1]?.length ?? 0;
      const hammingGroupCount =
        input.hammingPartition.families[hammingFamilyId - 1]?.length ?? 0;
      const unionGroupCount =
        jaccardGroupCount + hammingGroupCount - overlapIndexes.length;

      return {
        rank: 0,
        jaccardFamilyId,
        hammingFamilyId,
        overlapGroupCount: overlapIndexes.length,
        jaccardGroupCount,
        hammingGroupCount,
        overlapShareOfJaccard:
          jaccardGroupCount === 0 ? 0 : overlapIndexes.length / jaccardGroupCount,
        overlapShareOfHamming:
          hammingGroupCount === 0 ? 0 : overlapIndexes.length / hammingGroupCount,
        overlapJaccard:
          unionGroupCount === 0 ? 0 : overlapIndexes.length / unionGroupCount,
        overlapTickerCount: overlapIndexes.reduce(
          (total, groupIndex) => total + input.groups[groupIndex].members.length,
          0,
        ),
        topSignals: buildTopSignalsForGroupIndexes(input.groups, overlapIndexes),
        topMembers: buildTopMembersForGroupIndexes(input.groups, overlapIndexes),
      };
    })
    .sort(
      (a, b) =>
        b.overlapGroupCount - a.overlapGroupCount ||
        b.overlapTickerCount - a.overlapTickerCount ||
        a.jaccardFamilyId - b.jaccardFamilyId ||
        a.hammingFamilyId - b.hammingFamilyId,
    )
    .slice(0, 8)
    .map((matchedFamily, index) => ({
      ...matchedFamily,
      rank: index + 1,
    }));
}

function buildTopMembersForGroupIndexes(
  groups: CombinationGroupDraft[],
  groupIndexes: number[],
) {
  return groupIndexes
    .flatMap((groupIndex) => groups[groupIndex].members)
    .sort(compareMembers)
    .slice(0, 5);
}

function countTickersForGroupIndexes(
  groups: CombinationGroupDraft[],
  groupIndexes: number[],
) {
  return groupIndexes.reduce(
    (total, groupIndex) => total + groups[groupIndex].members.length,
    0,
  );
}

function buildFamilyIdsByGroupIndex(families: number[][]) {
  const familyIdsByGroupIndex = new Map<number, number>();

  for (let familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
    for (const groupIndex of families[familyIndex]) {
      familyIdsByGroupIndex.set(groupIndex, familyIndex + 1);
    }
  }

  return familyIdsByGroupIndex;
}

function buildTopSignalsForGroupIndexes(
  groups: CombinationGroupDraft[],
  groupIndexes: number[],
) {
  const signalCounts = new Map<
    string,
    {
      signal: TickerSignalCombinationSignal;
      groupCount: number;
      tickerCount: number;
    }
  >();
  const totalTickerCount = groupIndexes.reduce(
    (total, groupIndex) => total + groups[groupIndex].members.length,
    0,
  );

  for (const groupIndex of groupIndexes) {
    const tickerCount = groups[groupIndex].members.length;

    for (const signal of groups[groupIndex].activeSignals) {
      const current = signalCounts.get(signal.token) ?? {
        signal,
        groupCount: 0,
        tickerCount: 0,
      };
      current.groupCount += 1;
      current.tickerCount += tickerCount;
      signalCounts.set(signal.token, current);
    }
  }

  return [...signalCounts.values()]
    .sort(
      (a, b) =>
        b.tickerCount - a.tickerCount ||
        b.groupCount - a.groupCount ||
        a.signal.factor.localeCompare(b.signal.factor) ||
        a.signal.axis.localeCompare(b.signal.axis) ||
        a.signal.signalKey.localeCompare(b.signal.signalKey),
    )
    .slice(0, 5)
    .map((signalCount) => ({
      signal: signalCount.signal,
      groupCount: signalCount.groupCount,
      tickerCount: signalCount.tickerCount,
      share:
        totalTickerCount === 0 ? 0 : signalCount.tickerCount / totalTickerCount,
      groupShare:
        groupIndexes.length === 0 ? 0 : signalCount.groupCount / groupIndexes.length,
    }));
}

function buildSignalShareMapForGroupIndexes(
  groups: CombinationGroupDraft[],
  groupIndexes: number[],
) {
  const signalCounts = new Map<string, number>();
  const totalTickerCount = groupIndexes.reduce(
    (total, groupIndex) => total + groups[groupIndex].members.length,
    0,
  );

  for (const groupIndex of groupIndexes) {
    const tickerCount = groups[groupIndex].members.length;

    for (const signal of groups[groupIndex].activeSignals) {
      signalCounts.set(
        signal.token,
        (signalCounts.get(signal.token) ?? 0) + tickerCount,
      );
    }
  }

  return new Map(
    [...signalCounts.entries()].map(([token, count]) => [
      token,
      totalTickerCount === 0 ? 0 : count / totalTickerCount,
    ]),
  );
}

function adjustedRandIndex(aLabels: number[], bLabels: number[]) {
  if (aLabels.length !== bLabels.length || aLabels.length < 2) return 0;

  const contingency = new Map<string, number>();
  const aCounts = new Map<number, number>();
  const bCounts = new Map<number, number>();

  for (let index = 0; index < aLabels.length; index += 1) {
    const aLabel = aLabels[index];
    const bLabel = bLabels[index];
    const key = `${aLabel}:${bLabel}`;

    contingency.set(key, (contingency.get(key) ?? 0) + 1);
    aCounts.set(aLabel, (aCounts.get(aLabel) ?? 0) + 1);
    bCounts.set(bLabel, (bCounts.get(bLabel) ?? 0) + 1);
  }

  const sumCombination = [...contingency.values()].reduce(
    (total, count) => total + choose2(count),
    0,
  );
  const aCombination = [...aCounts.values()].reduce(
    (total, count) => total + choose2(count),
    0,
  );
  const bCombination = [...bCounts.values()].reduce(
    (total, count) => total + choose2(count),
    0,
  );
  const totalCombination = choose2(aLabels.length);
  const expectedIndex =
    totalCombination === 0
      ? 0
      : (aCombination * bCombination) / totalCombination;
  const maxIndex = (aCombination + bCombination) / 2;
  const denominator = maxIndex - expectedIndex;

  if (denominator === 0) return 0;
  return (sumCombination - expectedIndex) / denominator;
}

function choose2(value: number) {
  return value < 2 ? 0 : (value * (value - 1)) / 2;
}

function buildThresholdCandidates(input: {
  groups: CombinationGroupDraft[];
  groupIdsByKey: Map<string, number>;
  pairwiseSimilarities: PairwiseSimilarity[];
  thresholdStats: TickerSignalCombinationThresholdStat[];
  similarity: SimilarityLens;
}): TickerSignalCombinationThresholdCandidate[] {
  const meaningfulComponentSize = Math.max(
    10,
    Math.ceil(input.groups.length * 0.02),
  );
  const emergenceThreshold =
    input.thresholdStats.find(
      (stat) => stat.secondLargestFamilySize >= meaningfulComponentSize,
    )?.threshold ?? 0.4;
  const disappearanceThreshold =
    input.thresholdStats.find(
      (stat) =>
        stat.threshold > emergenceThreshold &&
        stat.secondLargestFamilySize < meaningfulComponentSize,
    )?.threshold ?? 0.7;
  const giantCollapseThreshold =
    findLargestComponentCliff(input.thresholdStats, emergenceThreshold) ??
    0.75;
  const candidateDefinitions = [
    {
      kind: "secondary_emergence" as const,
      label: "Secondary component emerges",
      threshold: emergenceThreshold,
    },
    {
      kind: "secondary_disappearance" as const,
      label: "Secondary component disappears",
      threshold: disappearanceThreshold,
    },
    {
      kind: "giant_collapse" as const,
      label: "Giant component collapse",
      threshold: giantCollapseThreshold,
    },
  ];

  return candidateDefinitions.map((definition) => {
    const stat =
      input.thresholdStats.find(
        (candidate) =>
          Number(candidate.threshold.toFixed(2)) === definition.threshold,
      ) ?? input.thresholdStats[0];

    return {
      ...definition,
      familyCount: stat.familyCount,
      largestFamilySize: stat.largestFamilySize,
      secondLargestFamilySize: stat.secondLargestFamilySize,
      singletonFamilyCount: stat.singletonFamilyCount,
      topFamilies: buildFamilySummariesAtThreshold({
        groups: input.groups,
        groupIdsByKey: input.groupIdsByKey,
        pairwiseSimilarities: input.pairwiseSimilarities,
        threshold: definition.threshold,
        similarity: input.similarity,
      }),
    };
  });
}

function findLargestComponentCliff(
  thresholdStats: TickerSignalCombinationThresholdStat[],
  afterThreshold: number,
): number | null {
  let bestThreshold: number | null = null;
  let biggestDrop = 0;

  for (let index = 1; index < thresholdStats.length; index += 1) {
    const previous = thresholdStats[index - 1];
    const current = thresholdStats[index];

    if (current.threshold <= afterThreshold) continue;

    const drop = previous.largestFamilySize - current.largestFamilySize;

    if (drop > biggestDrop) {
      biggestDrop = drop;
      bestThreshold = current.threshold;
    }
  }

  return bestThreshold;
}

function buildFamilySummariesAtThreshold(input: {
  groups: CombinationGroupDraft[];
  groupIdsByKey: Map<string, number>;
  pairwiseSimilarities: PairwiseSimilarity[];
  threshold: number;
  similarity: SimilarityLens;
}): TickerSignalCombinationFamilySummary[] {
  const groupIndexesByKey = new Map(
    input.groups.map((group, index) => [group.combinationKey, index]),
  );
  const disjointSet = new DisjointSet(input.groups.length);

  for (const pair of input.pairwiseSimilarities) {
    const pairSimilarity = getPairSimilarity(pair, input.similarity);

    if (!isConnectedAtThreshold(pairSimilarity, input.threshold)) continue;

    const aIndex = groupIndexesByKey.get(pair.aCombinationKey);
    const bIndex = groupIndexesByKey.get(pair.bCombinationKey);

    if (aIndex === undefined || bIndex === undefined) continue;
    disjointSet.union(aIndex, bIndex);
  }

  const familySummaries = disjointSet
    .families()
    .map((familyIndexes) => buildFamilySummary(familyIndexes, input))
    .sort(
      (a, b) =>
        b.groupCount - a.groupCount ||
        b.tickerCount - a.tickerCount ||
        a.familyId - b.familyId,
    );

  return familySummaries
    .slice(0, familySummaries.length <= 20 ? familySummaries.length : 12)
    .map((family, index) => ({
      ...family,
      familyId: index + 1,
    }));
}

function buildFamilySummary(
  familyIndexes: number[],
  input: {
    groups: CombinationGroupDraft[];
    groupIdsByKey: Map<string, number>;
  },
): TickerSignalCombinationFamilySummary {
  const groups = familyIndexes.map((index) => input.groups[index]);
  const signalCounts = new Map<
    string,
    {
      signal: TickerSignalCombinationSignal;
      groupCount: number;
      tickerCount: number;
    }
  >();

  for (const group of groups) {
    const tickerCount = group.members.length;

    for (const signal of group.activeSignals) {
      const current = signalCounts.get(signal.token) ?? {
        signal,
        groupCount: 0,
        tickerCount: 0,
      };
      current.groupCount += 1;
      current.tickerCount += tickerCount;
      signalCounts.set(signal.token, current);
    }
  }

  const groupCount = groups.length;
  const tickerCount = groups.reduce(
    (total, group) => total + group.members.length,
    0,
  );
  const topSignals = [...signalCounts.values()]
    .sort(
      (a, b) =>
        b.tickerCount - a.tickerCount ||
        b.groupCount - a.groupCount ||
        a.signal.factor.localeCompare(b.signal.factor) ||
        a.signal.axis.localeCompare(b.signal.axis) ||
        a.signal.signalKey.localeCompare(b.signal.signalKey),
    )
    .slice(0, 6)
    .map((signalCount) => ({
      signal: signalCount.signal,
      groupCount: signalCount.groupCount,
      tickerCount: signalCount.tickerCount,
      share: tickerCount === 0 ? 0 : signalCount.tickerCount / tickerCount,
      groupShare: groupCount === 0 ? 0 : signalCount.groupCount / groupCount,
    }));
  const sampleGroups = groups
    .map((group) => ({
      groupId: input.groupIdsByKey.get(group.combinationKey) ?? 0,
      combinationKey: group.combinationKey,
      tickerCount: group.members.length,
      activeSignalCount: group.activeSignals.length,
    }))
    .sort(
      (a, b) =>
        b.tickerCount - a.tickerCount ||
        b.activeSignalCount - a.activeSignalCount ||
        a.groupId - b.groupId,
    )
    .slice(0, 5);

  return {
    familyId: 0,
    groupCount,
    tickerCount,
    topSignals,
    sampleGroups,
  };
}

function addNearestGroup(
  nearestGroupsByKey: Map<string, TickerSignalCombinationNearestGroup[]>,
  combinationKey: string,
  candidate: TickerSignalCombinationNearestGroup,
) {
  const nearestGroups = nearestGroupsByKey.get(combinationKey) ?? [];
  nearestGroups.push(candidate);
  nearestGroups.sort(
    (a, b) =>
      b.jaccardSimilarity - a.jaccardSimilarity ||
      b.tickerCount - a.tickerCount ||
      a.groupId - b.groupId,
  );
  nearestGroupsByKey.set(combinationKey, nearestGroups.slice(0, 5));
}

function buildSignalToken(row: {
  factor: string;
  axis: string;
  signal_key: string;
}) {
  return `${row.factor}.${row.axis}.${row.signal_key}`;
}

function buildFeatureToken(row: {
  factor: string;
  axis: string;
  metric_key: string;
  feature_key: string;
}) {
  return `${row.factor}.${row.axis}.${row.metric_key}.${row.feature_key}`;
}

function buildStateVector(
  statesByAxis: Map<string, string>,
  factorAxisKeys: string[],
) {
  return factorAxisKeys.map(
    (factorAxisKey) => `${factorAxisKey}=${statesByAxis.get(factorAxisKey) ?? "missing"}`,
  );
}

function hashCombination(tokens: string[]) {
  return createHash("sha1").update(tokens.join("|")).digest("hex").slice(0, 12);
}

function isDirectionalSignal(signalKey: string) {
  return !signalKey.startsWith("mixed_");
}

function countDifferentStates(a: string[], b: string[]) {
  const length = Math.max(a.length, b.length);
  let differentCount = 0;

  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) differentCount += 1;
  }

  return differentCount;
}

function compareSignals(
  a: TickerSignalCombinationSignal,
  b: TickerSignalCombinationSignal,
) {
  return (
    a.factor.localeCompare(b.factor) ||
    a.axis.localeCompare(b.axis) ||
    a.signalKey.localeCompare(b.signalKey)
  );
}

function compareMembers(
  a: TickerSignalCombinationMember,
  b: TickerSignalCombinationMember,
) {
  return (
    (b.marketCap ?? -1) - (a.marketCap ?? -1) ||
    a.ticker.localeCompare(b.ticker)
  );
}

function incrementCount(counts: Map<string, number>, name: string) {
  const normalizedName = name.trim() === "" ? "Unclassified" : name;
  counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
}

function toCategoryStats(
  counts: Map<string, number>,
  total: number,
  limit: number,
): TickerClusterCategoryStat[] {
  if (total === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({
      name,
      count,
      share: count / total,
    }));
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  );
}

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function toDateText(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}
