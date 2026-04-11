import { ENV } from "@/backend/config/env";

export type UsMarketHolidayRecord = {
  date?: string;
  exchange?: string;
  name?: string;
};

type HolidayCache = {
  fetchedAtYmd: string;
  holidays: Set<string>;
};

let holidayCache: HolidayCache | null = null;

function getNewYorkYmd(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export async function fetchUsMarketHolidays(): Promise<Set<string>> {
  const todayNy = getNewYorkYmd();

  if (holidayCache && holidayCache.fetchedAtYmd === todayNy) {
    return holidayCache.holidays;
  }

  const url =
    `https://financialmodelingprep.com/stable/holidays-by-exchange` +
    `?exchange=NASDAQ&apikey=${ENV.FMP_API_KEY}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch US market holidays: ${res.status}`);
  }

  const json = (await res.json()) as UsMarketHolidayRecord[];

  if (!Array.isArray(json)) {
    throw new Error("Invalid holiday response from FMP");
  }

  const holidays = new Set(
    json
      .map((item) => item.date)
      .filter((date): date is string => Boolean(date)),
  );

  holidayCache = {
    fetchedAtYmd: todayNy,
    holidays,
  };

  return holidays;
}
