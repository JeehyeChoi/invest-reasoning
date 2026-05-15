import type { SecCompanyFactsMetricKey } from "@/backend/config/sec/metrics";
import type { CompanyFactsSeriesTagMeta } from "@/backend/services/sec/companyFacts/series/tagMeta";

export const TAG_META_EXPERMENT_WORKFLOW_TYPE =
  "tag_experiment:instant_candidates_v1";

export type CompanyFactsSeriesExperimentTagMeta =
  Omit<CompanyFactsSeriesTagMeta, "tagFamily"> & {
    enabled: boolean;
    tagFamily: string;
    includeSectors?: string[];
    excludeSectors?: string[];
    notes?: string;
  };

function experimentalInstant(
  metricKey: SecCompanyFactsMetricKey,
  priority: number,
  options: Omit<
    CompanyFactsSeriesExperimentTagMeta,
    "metricKey" | "factType" | "priority"
  >,
): CompanyFactsSeriesExperimentTagMeta {
  return {
    metricKey,
    factType: "instant",
    priority,
    ...options,
  };
}

export const COMPANY_FACTS_SERIES_TAG_META_EXPERMENT: Record<
  string,
  CompanyFactsSeriesExperimentTagMeta
> = {
  DebtInstrumentCarryingAmount: experimentalInstant("total_debt", 50, {
    enabled: true,
    tagFamily: "debt_instrument_carrying_amount",
    notes:
      "Candidate-stats debt fallback. Kept enabled for random-sample experiment runs after stable low-priority promotion.",
  }),
  AdditionalPaidInCapitalCommonStock: experimentalInstant(
    "common_stock_and_apic",
    50,
    {
      enabled: true,
      tagFamily: "additional_paid_in_capital",
      notes:
        "Candidate-stats APIC candidate. Kept separate from authorized/issued/share-count/par-value common stock tags.",
    },
  ),
  AccountsReceivableGrossCurrent: experimentalInstant("accounts_receivable", 50, {
    enabled: true,
    tagFamily: "trade_receivable_gross",
    excludeSectors: ["Financial Services"],
    notes:
      "Candidate-stats receivable fallback for non-financial trade receivables.",
  }),
  ReceivablesNetCurrent: experimentalInstant("accounts_receivable", 51, {
    enabled: true,
    tagFamily: "trade_receivable_net",
    excludeSectors: ["Financial Services"],
    notes:
      "Candidate-stats receivable fallback for non-financial trade receivables.",
  }),
  AccountsPayableAndAccruedLiabilitiesCurrent: experimentalInstant(
    "accounts_payable",
    50,
    {
      enabled: false,
      tagFamily: "payable_plus_accruals",
      notes:
        "Noisy payable candidate because it combines accounts payable with accrued liabilities.",
    },
  ),
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents:
    experimentalInstant("cash_and_cash_equivalents", 50, {
      enabled: false,
      tagFamily: "cash_plus_restricted_cash",
      notes:
        "Noisy cash candidate because restricted cash should not automatically backfill unrestricted cash.",
    }),
  LiabilitiesCurrent: experimentalInstant("liabilities", 50, {
    enabled: false,
    tagFamily: "current_liabilities",
    notes:
      "Current liabilities is not a full liabilities substitute; keep disabled until a separate policy is chosen.",
  }),
};

export function isExperimentTagAllowedForSector(input: {
  meta: CompanyFactsSeriesExperimentTagMeta;
  sector: string | null | undefined;
}): boolean {
  if (!input.meta.enabled) return false;

  const sector = input.sector?.trim();

  if (input.meta.includeSectors?.length) {
    return Boolean(sector && input.meta.includeSectors.includes(sector));
  }

  if (sector && input.meta.excludeSectors?.includes(sector)) {
    return false;
  }

  return true;
}
