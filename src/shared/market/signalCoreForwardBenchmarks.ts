export type SignalCoreForwardBenchmark = {
  ticker: string;
  theme: string;
};

export const SIGNAL_CORE_FORWARD_BENCHMARKS = [
  { ticker: "SPY", theme: "Market benchmark" },
  { ticker: "QQQ", theme: "Growth / mega-cap tech benchmark" },
  { ticker: "DIA", theme: "Dow large-cap benchmark" },
  { ticker: "RSP", theme: "Equal-weight market" },
  { ticker: "IWM", theme: "Small/mid risk" },
  { ticker: "XLU", theme: "Defensive sector / utilities" },
  { ticker: "XLP", theme: "Defensive sector / staples" },
  { ticker: "XLV", theme: "Defensive sector / healthcare" },
  { ticker: "XLY", theme: "Cyclical sector / discretionary" },
  { ticker: "XLI", theme: "Cyclical sector / industrials" },
  { ticker: "XLF", theme: "Rate / credit sensitive financials" },
  { ticker: "XLE", theme: "Commodity / energy" },
  { ticker: "XLK", theme: "Growth / technology" },
  { ticker: "TLT", theme: "Long-duration rates" },
  { ticker: "IEF", theme: "Intermediate-duration rates" },
  { ticker: "SHY", theme: "Short-duration rates" },
  { ticker: "KRE", theme: "Regional bank credit/rates" },
  { ticker: "HYG", theme: "High-yield credit risk" },
  { ticker: "LQD", theme: "Investment-grade credit" },
  { ticker: "GLD", theme: "Gold" },
  { ticker: "SLV", theme: "Silver" },
  { ticker: "DBC", theme: "Broad commodities" },
  { ticker: "USO", theme: "Oil" },
  { ticker: "MTUM", theme: "Momentum" },
  { ticker: "QUAL", theme: "Quality" },
  { ticker: "USMV", theme: "Low volatility" },
  { ticker: "VLUE", theme: "Value" },
  { ticker: "SCHD", theme: "Dividend quality" },
  { ticker: "VIG", theme: "Dividend growth" },
] as const satisfies readonly SignalCoreForwardBenchmark[];

export const SIGNAL_CORE_FORWARD_BENCHMARK_TICKERS =
  SIGNAL_CORE_FORWARD_BENCHMARKS.map((benchmark) => benchmark.ticker);

export const SIGNAL_CORE_FORWARD_BENCHMARK_THEME_BY_TICKER = Object.fromEntries(
  SIGNAL_CORE_FORWARD_BENCHMARKS.map((benchmark) => [
    benchmark.ticker,
    benchmark.theme,
  ]),
) as Record<string, string>;

export function getSignalCoreForwardBenchmarkTheme(ticker: string) {
  return SIGNAL_CORE_FORWARD_BENCHMARK_THEME_BY_TICKER[ticker.toUpperCase()] ?? "-";
}
