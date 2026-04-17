// backend/services/filings/parseItem801Signals.ts

import { extractDividendSignal, type DividendSignal } from "./signals/extractDividendSignal";

export type FilingSignal =
  | {
      type: "dividend";
      data: DividendSignal;
    }
  | {
      type: "unknown";
      data: null;
    };

export function parseItem801Signals(text: string): FilingSignal | null {
  if (!text) return null;

  // 1️⃣ dividend detection (가장 먼저)
  if (/dividend/i.test(text)) {
    const dividend = extractDividendSignal(text);

    if (dividend) {
      return {
        type: "dividend",
        data: dividend,
      };
    }
  }

  // 👉 나중 확장 가능
  // if (/earnings/i.test(text)) { ... }
  // if (/appoint|resign/i.test(text)) { ... }

  return {
    type: "unknown",
    data: null,
  };
}
