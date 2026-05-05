export type EtfHoldingRecord = {
  ticker: string;
  name?: string;
  sector?: string;
  industry?: string;
  assetClass?: string;
  exchange?: string;
  sourcePayload: Record<string, string>;
};
