import type { CalculatedPortfolioItem } from "@/features/portfolio/utils/calculatePortfolio";
import type {
  EnrichedPortfolioItem,
  ExposureSummary,
  PortfolioAnalysisWorkflowStep,
} from "../workflow.types";


type MetadataBundle = {
  profile?: {
    country?: string | null;
  } | null;
  classification?: {
    sector?: string | null;
    industry?: string | null;
  } | null;
  tags?: Array<{
    tag: string;
    source_rule?: string | null;
  }>;
} | null;

type ExposureBucketMap = Record<string, number>;
type WeightMode = "current" | "target";

function getWeight(item: CalculatedPortfolioItem, mode: WeightMode): number {
  if (mode === "current") {
    return typeof item.currentWeight === "number" ? item.currentWeight : 0;
  }

  return typeof item.targetWeight === "number" ? item.targetWeight : 0;
}

function addToBucket(
  bucket: ExposureBucketMap,
  key: string | null | undefined,
  weight: number,
) {
  if (!key) return;
  bucket[key] = (bucket[key] ?? 0) + weight;
}

function enrichPortfolioWithMetadata(
  calculatedPortfolio: CalculatedPortfolioItem[],
  byTicker?: Record<string, MetadataBundle>,
): EnrichedPortfolioItem[] {
  return calculatedPortfolio.map((item) => {
    if (item.ticker === "__CASH__") {
      return {
        ...item,
        sector: "Cash",
        industry: "Cash",
        country: "Cash",
        tags: [],
      };
    }

    const metadata = byTicker?.[item.ticker];

    return {
      ...item,
      sector: metadata?.classification?.sector ?? null,
      industry: metadata?.classification?.industry ?? null,
      country: metadata?.profile?.country ?? null,
      tags: Array.isArray(metadata?.tags)
        ? metadata.tags.map((tagItem) => tagItem.tag)
        : [],
    };
  });
}

function buildExposureSummary(
  enrichedPortfolio: EnrichedPortfolioItem[],
  mode: WeightMode,
): ExposureSummary {
  const bySector: ExposureBucketMap = {};
  const byIndustry: ExposureBucketMap = {};
  const byTag: ExposureBucketMap = {};
  const byCountry: ExposureBucketMap = {};

  for (const item of enrichedPortfolio) {
    const weight = getWeight(item, mode);

    addToBucket(bySector, item.sector, weight);
    addToBucket(byIndustry, item.industry, weight);
    addToBucket(byCountry, item.country, weight);

    for (const tag of item.tags) {
      addToBucket(byTag, tag, weight);
    }
  }

  return {
    bySector,
    byIndustry,
    byTag,
    byCountry,
  };
}

export const computeExposureStep: PortfolioAnalysisWorkflowStep = {
  name: "compute_exposure",

  async run(context) {
    const enrichedPortfolio = enrichPortfolioWithMetadata(
      context.input.calculatedPortfolio,
      context.artifacts.metadata?.byTicker,
    );

    const currentExposure = buildExposureSummary(enrichedPortfolio, "current");
    const targetExposure = buildExposureSummary(enrichedPortfolio, "target");

    return {
      ...context,
      artifacts: {
        ...context.artifacts,
        exposure: {
          enrichedPortfolio,
          currentExposure,
          targetExposure,
          computedAt: new Date().toISOString(),
        },
      },
    };
  },
};
