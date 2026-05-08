import { twelveDataDailyPriceHistoryProvider } from "@/backend/services/market/history/providers/twelveDataProvider";
import type {
  DailyPriceHistoryProvider,
  DailyPriceProviderKey,
} from "@/backend/services/market/history/types";

export function getDailyPriceHistoryProvider(
  provider: DailyPriceProviderKey,
): DailyPriceHistoryProvider {
  switch (provider) {
    case "twelve_data":
      return twelveDataDailyPriceHistoryProvider;
  }
}
