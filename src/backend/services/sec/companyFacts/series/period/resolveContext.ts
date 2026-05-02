import type { CompanyFiscalProfile } from "@/backend/services/sec/companyFacts/series/fiscal/types";
import {
  buildFiscalQuarterWindows,
  buildFiscalYearWindows,
  type FiscalQuarterWindow,
  type FiscalYearWindow,
} from "@/backend/services/sec/companyFacts/series/period/buildPeriodWindows";

export type PeriodResolveContext = {
  fiscalProfile: CompanyFiscalProfile | null;
  fiscalYearWindows: FiscalYearWindow[];
  fiscalQuarterWindows: FiscalQuarterWindow[];
};

export function buildPeriodResolveContext(
  fiscalProfile: CompanyFiscalProfile | null,
): PeriodResolveContext {
  if (!fiscalProfile) {
    return {
      fiscalProfile: null,
      fiscalYearWindows: [],
      fiscalQuarterWindows: [],
    };
  }

  const fiscalYearWindows = buildFiscalYearWindows(fiscalProfile);
  const fiscalQuarterWindows = buildFiscalQuarterWindows(fiscalProfile);

  return {
    fiscalProfile,
    fiscalYearWindows,
    fiscalQuarterWindows,
  };
}
