// backend/services/disclosures/sec/parseSecDisclosureDocument.ts

import type { FilingForm } from "@/shared/disclosures/sec/constants";
import type { RecentSecDisclosureItem } from "@/shared/disclosures/sec/types";
import { extractFilingSignal } from "@/backend/services/disclosures/sec/extractFilingSignal";
import { parseFilingExhibits } from "@/backend/services/disclosures/sec/parseFilingExhibits";
import { parseFilingItems } from "@/backend/services/disclosures/sec/parseFilingItems";

type ParseSecDisclosureDocumentInput = {
  form: FilingForm | string;
  rawDocument: string;
  filingKey?: string;
};

type ParsedSecDisclosureDocument = Pick<
  RecentSecDisclosureItem,
  "filingItems" | "exhibits"
>;

export function parseSecDisclosureDocument({
  form,
  rawDocument,
  filingKey,
}: ParseSecDisclosureDocumentInput): ParsedSecDisclosureDocument {
  const parsedItems = parseFilingItems(rawDocument, { form });

  return {
    filingItems: parsedItems.map((item) => ({
      itemCode: item.itemCode,
      itemTitle: item.itemTitle,
      signal: extractFilingSignal({
        form,
        itemCode: item.itemCode,
        itemTitle: item.itemTitle,
        text: item.body,
      }),
    })),
    exhibits: parseFilingExhibits(rawDocument, filingKey),
  };
}
