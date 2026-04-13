import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","are","was","were",
  "has","have","had","its","their","our","they","them","his","her",

  "company","companies","business","businesses",
  "provides","provide","provided","providing",
  "services","service","solutions","solution",
  "products","product","customers","customer",
  "operations","operates","operating",
  "offer","offers","offering","offered",
  "develops","developed","developing",
  "manufactures","manufacturing",
  "markets","marketed",
  "including",

  "inc","corp","corporation","ltd","plc","group","holding","holdings",
  "international","global","worldwide",

  // 추가 제거
  "sells","stores","clients","content","development",
  "design","designs","processing","distribution","distributes",
  "manufacturers","manages","management",
  "information","industry","industries",
  "commercial","institutional","professional",
  "production","performance","programs","areas","providers",
  "focused","managed","managing","generates",
  "analysis","force","point","large","fixed","middle","further",

  // 지리/법인/서술어
	"united","states","america","american","north",
	"california","york","illinois","kingdom","internationally",
  "headquartered","founded","incorporated","formerly","known","name",
  "based","related","various","addition","approximately","primarily",
  "through","other","well","also","such","under","which","across",
  "general","public","private","third","four","three","together"
]);

const BIGRAM_STOPWORDS = new Set([
  "segment","segments",
  "firm","firms",
  "seeks","seek",
  "engages","serves",
  "make","makes",
  "additional","offices",
  "changed","april","october","december",
  "direct","sales"
]);

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function buildCompanyNameBlacklist(rows) {
  const blacklist = new Set();

  for (const row of rows) {
    const company = row.company_name ?? "";
    const tokens = normalizeText(company)
      .split(" ")
      .filter((w) => w.length > 2);

    for (const t of tokens) {
      blacklist.add(t);
    }
  }

  // 흔한 법인명 추가
  [
    "inc","corp","corporation","company","group","holdings","holding",
    "technologies","technology","systems"
  ].forEach((w) => blacklist.add(w));

  return blacklist;
}


function normalizeToken(token) {
  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizeBigram(a, b) {
  a = normalizeToken(a);
  b = normalizeToken(b);

  if (!a || !b) return null;
  if (BIGRAM_STOPWORDS.has(a) || BIGRAM_STOPWORDS.has(b)) return null;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return null;

  const months = new Set([
    "january","february","march","april","may","june",
    "july","august","september","october","november","december"
  ]);
  if (months.has(a) || months.has(b)) return null;

  const geoWords = new Set([
    "asia","europe","africa","pacific","canada","mexico",
    "japan","korea","taiwan","latin"
  ]);

  if (geoWords.has(a) && geoWords.has(b)) {
    return [a, b].sort().join(" ");
  }

  return `${a} ${b}`;
}

function countItems(items) {
  const freq = new Map();
  for (const item of items) {
    freq.set(item, (freq.get(item) ?? 0) + 1);
  }
  return freq;
}

function toSortedArray(freqMap, minCount = 1, limit = 200) {
  return Array.from(freqMap.entries())
    .map(([word, count]) => ({ word, count }))
    .filter((x) => x.count >= minCount)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

async function main() {
  const client = await pool.connect();

  try {
    const { rows } = await client.query(`
      SELECT ticker, company_name, description
      FROM ticker_profiles
      WHERE description IS NOT NULL
    `);

    const companyNameBlacklist = buildCompanyNameBlacklist(rows);

    const unigramList = [];
    const bigramList = [];

    for (const row of rows) {
      const tokens = tokenize(row.description).filter(
        (t) => !companyNameBlacklist.has(t),
      );

      for (const t of tokens) {
        unigramList.push(t);
      }

			for (let i = 0; i < tokens.length - 1; i++) {
				const a = tokens[i];
				const b = tokens[i + 1];

				if (companyNameBlacklist.has(a) || companyNameBlacklist.has(b)) continue;
				if (a.length < 3 || b.length < 3) continue;

				const phrase = normalizeBigram(a, b);
				if (phrase) {
					bigramList.push(phrase);
				}
			}
    }

    const unigramFreq = countItems(unigramList);
    const bigramFreq = countItems(bigramList);

    const unigramResult = toSortedArray(unigramFreq, 6, 200);
    const bigramResult = toSortedArray(bigramFreq, 3, 200);

		aconst outputDir = path.resolve("scripts", "data");
		await fs.mkdir(outputDir, { recursive: true });

		const unigramPath = path.join(outputDir, "description-keywords.json");
		const bigramPath = path.join(outputDir, "description-bigrams.json");

		await fs.writeFile(
			unigramPath,
			JSON.stringify(unigramResult, null, 2),
		);

		await fs.writeFile(
			bigramPath,
			JSON.stringify(bigramResult, null, 2),
		);

		console.log(
			`✅ saved ${unigramResult.length} keywords to ${unigramPath}`
		);
		console.log(
			`✅ saved ${bigramResult.length} bigrams to ${bigramPath}`
		);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
