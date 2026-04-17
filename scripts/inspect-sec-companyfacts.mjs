import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SEC_DATA_BASE = "https://data.sec.gov";
const TICKER_MAPPING_URL = "https://www.sec.gov/files/company_tickers.json";
const DEFAULT_TICKER = "AAPL";
const DEFAULT_SAMPLE_POINT_LIMIT = 1000;
const DEFAULT_TOP_TAG_LIMIT = 100;
const DEFAULT_TOP_TAG_MIN_POINT_COUNT = 20;

const args = parseArgs(process.argv.slice(2));

const userAgent =
  process.env.SEC_USER_AGENT || "geo-portfolio dev contact@example.com";

async function main() {
  validateUserAgent(userAgent);

  const target = await resolveTarget(args);
  const sourceUrl = `${SEC_DATA_BASE}/api/xbrl/companyfacts/CIK${target.cikPadded}.json`;
  const doc = await fetchJson(sourceUrl);

  const pointSampleLimit = args.samplePoints ?? DEFAULT_SAMPLE_POINT_LIMIT;
  const topTagLimit = args.topTagLimit ?? DEFAULT_TOP_TAG_LIMIT;
  const topTagMinPointCount =
    args.topTagMinPointCount ?? DEFAULT_TOP_TAG_MIN_POINT_COUNT;

  const tagCatalog = buildTagCatalog(doc, sourceUrl);
  const schemaSummary = buildSchemaSummary(doc, sourceUrl, pointSampleLimit);
  const tagDistribution = buildTagDistribution(tagCatalog);
	const p95 = tagDistribution.summary.p95TotalPointCount;

  const topTags = buildTopTags(tagCatalog, {
    limit: topTagLimit,
    minTotalPointCount: p95,
    excludeDeprecated: true,
  });

  const outDir = path.resolve(process.cwd(), "scripts", "data");
  await fs.mkdir(outDir, { recursive: true });

  const outputs = [
    {
      filename: "sec-companyfacts-sample-schema.json",
      data: schemaSummary,
    },
    {
      filename: "sec-companyfacts-tag-catalog.json",
      data: tagCatalog,
    },
    {
      filename: "sec-companyfacts-tag-distribution.json",
      data: tagDistribution,
    },
    {
      filename: "sec-companyfacts-top-tags.json",
      data: topTags,
    },
  ];

  for (const output of outputs) {
    const filepath = path.join(outDir, output.filename);
    await writeJson(filepath, output.data);
  }

  console.log("Generated files:");
  for (const output of outputs) {
    console.log(`- scripts/data/${output.filename}`);
  }
}

function validateUserAgent(value) {
  if (!value || value.includes("contact@example.com")) {
    console.warn(
      "[warn] SEC_USER_AGENT is not customized. SEC may reject or throttle requests.",
    );
  }
}

function parseArgs(argv) {
  const parsed = {
    ticker: DEFAULT_TICKER,
    cik: null,
    samplePoints: DEFAULT_SAMPLE_POINT_LIMIT,
    topTagLimit: DEFAULT_TOP_TAG_LIMIT,
    topTagMinPointCount: DEFAULT_TOP_TAG_MIN_POINT_COUNT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--ticker" && argv[i + 1]) {
      parsed.ticker = String(argv[i + 1]).toUpperCase();
      i += 1;
      continue;
    }

    if (token === "--cik" && argv[i + 1]) {
      parsed.cik = String(argv[i + 1]).replace(/\D/g, "");
      i += 1;
      continue;
    }

    if (token === "--sample-points" && argv[i + 1]) {
      parsed.samplePoints = parsePositiveInteger(
        argv[i + 1],
        "--sample-points",
      );
      i += 1;
      continue;
    }

    if (token === "--top-tag-limit" && argv[i + 1]) {
      parsed.topTagLimit = parsePositiveInteger(argv[i + 1], "--top-tag-limit");
      i += 1;
      continue;
    }

    if (token === "--top-tag-min-point-count" && argv[i + 1]) {
      parsed.topTagMinPointCount = parseNonNegativeInteger(
        argv[i + 1],
        "--top-tag-min-point-count",
      );
      i += 1;
      continue;
    }

    if (token === "--help" || token === "-h") {
      printHelpAndExit();
    }
  }

  return parsed;
}

function printHelpAndExit() {
  console.log(`
Usage:
  node scripts/inspect-sec-companyfacts.mjs [options]

Options:
  --ticker <symbol>                 Ticker symbol (default: ${DEFAULT_TICKER})
  --cik <cik>                       Direct CIK input; overrides ticker
  --sample-points <n>               Sample point count for schema summary (default: ${DEFAULT_SAMPLE_POINT_LIMIT})
  --top-tag-limit <n>               Max tags in top-tags output (default: ${DEFAULT_TOP_TAG_LIMIT})
  --top-tag-min-point-count <n>     Min totalPointCount for top-tags selection (default: ${DEFAULT_TOP_TAG_MIN_POINT_COUNT})
  --help, -h                        Show help
`);
  process.exit(0);
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${flagName}: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flagName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${flagName}: ${value}`);
  }
  return parsed;
}

async function resolveTarget({ ticker, cik }) {
  if (cik) {
    return {
      cik,
      cikPadded: cik.padStart(10, "0"),
      label: `CIK ${cik}`,
    };
  }

  const mapping = await fetchJson(TICKER_MAPPING_URL);
  const entries = Object.values(mapping);

  const match = entries.find(
    (entry) => String(entry.ticker).toUpperCase() === ticker,
  );

  if (!match) {
    throw new Error(`Ticker not found in SEC mapping: ${ticker}`);
  }

  const cikStr = String(match.cik_str);

  return {
    cik: cikStr,
    cikPadded: cikStr.padStart(10, "0"),
    label: `${match.title} (${match.ticker})`,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await safeReadText(response);
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}\n${body}`,
    );
  }

  return response.json();
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function writeJson(filepath, data) {
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf8");
}

function buildSchemaSummary(doc, sourceUrl, samplePointLimit) {
  return {
    source: buildSourceInfo(doc, sourceUrl),
    topLevelKeys: Object.keys(doc),
    taxonomies: buildTaxonomySummary(doc),
    paths: ["facts.{taxonomy}.{tag}.units.{unit}[]"],
    pointFieldSummary: buildPointFieldSummary(doc, samplePointLimit),
    sampledPointCount: samplePointLimit,
  };
}

function buildTaxonomySummary(doc) {
  const facts = doc.facts ?? {};
  const result = [];

  for (const [taxonomy, tagMap] of Object.entries(facts)) {
    const tags = Object.keys(tagMap ?? {});
    result.push({
      name: taxonomy,
      tagCount: tags.length,
      sampleTags: tags.slice(0, 10),
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

function buildPointFieldSummary(doc, samplePointLimit) {
  const samples = collectPointSamples(doc, samplePointLimit);
  const fieldMap = {};

  for (const point of samples) {
    for (const [key, value] of Object.entries(point)) {
      if (!fieldMap[key]) {
        fieldMap[key] = {
          count: 0,
          types: new Set(),
        };
      }

      fieldMap[key].count += 1;
      fieldMap[key].types.add(inferType(value));
    }
  }

  const result = {};

  for (const [key, value] of Object.entries(fieldMap)) {
    result[key] = {
      count: value.count,
      types: Array.from(value.types).sort(),
    };
  }

  return sortObjectKeys(result);
}

function collectPointSamples(doc, maxPoints) {
  const samples = [];
  const facts = doc.facts ?? {};

  outer: for (const tagMap of Object.values(facts)) {
    for (const factDef of Object.values(tagMap ?? {})) {
      for (const points of Object.values(factDef?.units ?? {})) {
        if (!Array.isArray(points)) continue;

        for (const point of points) {
          samples.push(point);
          if (samples.length >= maxPoints) {
            break outer;
          }
        }
      }
    }
  }

  return samples;
}

function buildTagCatalog(doc, sourceUrl) {
  const facts = doc.facts ?? {};
  const taxonomies = [];

  for (const [taxonomy, tagMap] of Object.entries(facts)) {
    const tags = [];

    for (const [tag, factDef] of Object.entries(tagMap ?? {})) {
      const units = Object.keys(factDef?.units ?? {}).sort();
      const pointCountsByUnit = {};
      let totalPointCount = 0;

      for (const unit of units) {
        const points = factDef?.units?.[unit];
        const count = Array.isArray(points) ? points.length : 0;
        pointCountsByUnit[unit] = count;
        totalPointCount += count;
      }

      tags.push({
        tag,
        label: factDef?.label ?? null,
        description: factDef?.description ?? null,
        units,
        pointCountsByUnit,
        totalPointCount,
        isDeprecated: isDeprecatedFact(factDef),
      });
    }

    tags.sort(compareTagsByTotalPointCountThenName);

    taxonomies.push({
      name: taxonomy,
      tagCount: tags.length,
      tags,
    });
  }

  taxonomies.sort((a, b) => a.name.localeCompare(b.name));

  return {
    source: buildSourceInfo(doc, sourceUrl),
    taxonomies,
  };
}

function buildTagDistribution(tagCatalog) {
  const flatTags = flattenCatalogTags(tagCatalog);

  const counts = flatTags.map((item) => item.totalPointCount).sort((a, b) => a - b);

  return {
    source: tagCatalog.source,
    summary: {
      taxonomyCount: tagCatalog.taxonomies.length,
      tagCount: flatTags.length,
      minTotalPointCount: counts.length ? counts[0] : 0,
      maxTotalPointCount: counts.length ? counts[counts.length - 1] : 0,
      meanTotalPointCount: counts.length ? roundNumber(mean(counts), 2) : 0,
      medianTotalPointCount: percentile(counts, 0.5),
      p75TotalPointCount: percentile(counts, 0.75),
      p90TotalPointCount: percentile(counts, 0.9),
      p95TotalPointCount: percentile(counts, 0.95),
      deprecatedTagCount: flatTags.filter((item) => item.isDeprecated).length,
      nonDeprecatedTagCount: flatTags.filter((item) => !item.isDeprecated).length,
    },
    buckets: buildPointCountBuckets(counts),
    topTagsPreview: flatTags
      .slice()
      .sort(compareFlatTagsByTotalPointCountThenName)
      .slice(0, 25)
      .map(toCompactTagPreview),
  };
}

function buildPointCountBuckets(sortedCountsAscending) {
  const bucketDefinitions = [
    { key: "0", test: (n) => n === 0 },
    { key: "1", test: (n) => n === 1 },
    { key: "2-4", test: (n) => n >= 2 && n <= 4 },
    { key: "5-9", test: (n) => n >= 5 && n <= 9 },
    { key: "10-19", test: (n) => n >= 10 && n <= 19 },
    { key: "20-49", test: (n) => n >= 20 && n <= 49 },
    { key: "50-99", test: (n) => n >= 50 && n <= 99 },
    { key: "100+", test: (n) => n >= 100 },
  ];

  return bucketDefinitions.map((bucket) => ({
    range: bucket.key,
    count: sortedCountsAscending.filter(bucket.test).length,
  }));
}

function buildTopTags(
  tagCatalog,
  {
    limit = DEFAULT_TOP_TAG_LIMIT,
    minTotalPointCount = DEFAULT_TOP_TAG_MIN_POINT_COUNT,
    excludeDeprecated = true,
  } = {},
) {
  let candidates = flattenCatalogTags(tagCatalog);

  if (excludeDeprecated) {
    candidates = candidates.filter((item) => !item.isDeprecated);
  }

  candidates = candidates
    .filter((item) => item.totalPointCount >= minTotalPointCount)
    .sort(compareFlatTagsByTotalPointCountThenName)
    .slice(0, limit);

  return {
    source: tagCatalog.source,
    selectionRule: {
      limit,
      minTotalPointCount,
      excludeDeprecated,
      sort: ["totalPointCount desc", "taxonomy asc", "tag asc"],
    },
    tags: candidates.map((item) => ({
      taxonomy: item.taxonomy,
      tag: item.tag,
      label: item.label,
      description: item.description,
      units: item.units,
      pointCountsByUnit: item.pointCountsByUnit,
      totalPointCount: item.totalPointCount,
    })),
  };
}

function flattenCatalogTags(tagCatalog) {
  const flat = [];

  for (const taxonomyEntry of tagCatalog.taxonomies) {
    for (const tagEntry of taxonomyEntry.tags) {
      flat.push({
        taxonomy: taxonomyEntry.name,
        ...tagEntry,
      });
    }
  }

  return flat;
}

function compareTagsByTotalPointCountThenName(a, b) {
  if (b.totalPointCount !== a.totalPointCount) {
    return b.totalPointCount - a.totalPointCount;
  }
  return a.tag.localeCompare(b.tag);
}

function compareFlatTagsByTotalPointCountThenName(a, b) {
  if (b.totalPointCount !== a.totalPointCount) {
    return b.totalPointCount - a.totalPointCount;
  }
  if (a.taxonomy !== b.taxonomy) {
    return a.taxonomy.localeCompare(b.taxonomy);
  }
  return a.tag.localeCompare(b.tag);
}

function toCompactTagPreview(item) {
  return {
    taxonomy: item.taxonomy,
    tag: item.tag,
    label: item.label,
    units: item.units,
    totalPointCount: item.totalPointCount,
    isDeprecated: item.isDeprecated,
  };
}

function isDeprecatedFact(factDef) {
  const label = String(factDef?.label ?? "");
  const description = String(factDef?.description ?? "");
  return /deprecated/i.test(label) || /deprecated/i.test(description);
}

function buildSourceInfo(doc, sourceUrl) {
  return {
    cik: doc.cik,
    entityName: doc.entityName,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
  };
}

function inferType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function sortObjectKeys(object) {
  const result = {};
  for (const key of Object.keys(object).sort()) {
    result[key] = object[key];
  }
  return result;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedValuesAscending, p) {
  if (!sortedValuesAscending.length) return 0;
  if (p <= 0) return sortedValuesAscending[0];
  if (p >= 1) return sortedValuesAscending[sortedValuesAscending.length - 1];

  const index = Math.ceil(sortedValuesAscending.length * p) - 1;
  const clampedIndex = Math.min(
    Math.max(index, 0),
    sortedValuesAscending.length - 1,
  );

  return sortedValuesAscending[clampedIndex];
}

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
