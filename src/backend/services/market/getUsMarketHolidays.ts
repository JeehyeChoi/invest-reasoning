// backend/services/market/getUsMarketHolidays.ts

import { fetchFmpUsMarketHolidays } from "@/backend/clients/fmp";

type HolidayCache = {
  fetchedAtYmd: string;
  holidays: Set<string>;
};

export type UsMarketState = "holiday" | "weekend" | "preopen" | "open" | "closed";

let holidayCache: HolidayCache | null = null;

function getNewYorkNowParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    ymd: `${year}-${month}-${day}`,
    weekday,
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
    nowNy: `${year}-${month}-${day} ${String(hour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")} ET`,
  };
}

function isWeekend(weekday: string): boolean {
  return weekday === "Sat" || weekday === "Sun";
}

export async function getUsMarketHolidays(): Promise<Set<string>> {
  const { ymd } = getNewYorkNowParts();

  if (holidayCache && holidayCache.fetchedAtYmd === ymd) {
    return holidayCache.holidays;
  }

  const json = await fetchFmpUsMarketHolidays();

  const holidays = new Set(
    json
      .map((item) => item.date)
      .filter((date): date is string => Boolean(date))
  );

  holidayCache = {
    fetchedAtYmd: ymd,
    holidays,
  };

  return holidays;
}

export async function getUsMarketState(): Promise<{
  state: UsMarketState;
  label: string;
  nowNy: string;
}> {
  const { ymd, weekday, minutesSinceMidnight, nowNy } = getNewYorkNowParts();
  const holidays = await getUsMarketHolidays();

  if (holidays.has(ymd)) {
    return {
      state: "holiday",
      label: "Market is closed today",
      nowNy,
    };
  }

  if (isWeekend(weekday)) {
    return {
      state: "weekend",
      label: "Market is closed today",
      nowNy,
    };
  }

  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;

  if (minutesSinceMidnight < openMinutes) {
    return {
      state: "preopen",
      label: "Market opens soon",
      nowNy,
    };
  }

  if (minutesSinceMidnight < closeMinutes) {
    return {
      state: "open",
      label: "Market is open",
      nowNy,
    };
  }

  return {
    state: "closed",
    label: "Market is closed",
    nowNy,
  };
}
