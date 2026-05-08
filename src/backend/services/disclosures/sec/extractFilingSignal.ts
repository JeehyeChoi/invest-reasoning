// backend/services/disclosures/sec/extractFilingSignal.ts

import type { FilingForm } from "@/shared/disclosures/sec/constants";
import { extractDividendSignal, type DividendSignal } from "./signals/extractDividendSignal";

type FilingSignalInput = {
  form: FilingForm | string;
  itemCode: string;
  itemTitle: string | null;
  text: string;
};

export type FilingSignal =
  | {
      type: "dividend";
      data: DividendSignal;
    }
  | {
      type: "unknown";
      data: null;
    };

type FilingSignalExtractor = {
  type: FilingSignal["type"];
  matches: (input: FilingSignalInput) => boolean;
  extract: (input: FilingSignalInput) => FilingSignal | null;
};

const SIGNAL_EXTRACTORS: FilingSignalExtractor[] = [
  {
    type: "dividend",
    matches: ({ text }) => /dividend/i.test(text),
    extract: ({ text }) => {
      const dividend = extractDividendSignal(text);

      return dividend ? { type: "dividend", data: dividend } : null;
    },
  },
];

export function extractFilingSignal(input: FilingSignalInput): FilingSignal | null {
  for (const extractor of SIGNAL_EXTRACTORS) {
    if (!extractor.matches(input)) {
      continue;
    }

    const signal = extractor.extract(input);

    if (signal) {
      return signal;
    }
  }

  return null;
}
