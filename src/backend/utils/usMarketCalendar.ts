export type HolidayYmdSet = Set<string>;

const US_MARKET_TIMEZONE = "America/New_York";
const US_MARKET_OPEN_HOUR = 9;
const US_MARKET_OPEN_MINUTE = 30;

export function getNewYorkDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: US_MARKET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday,
    hour: Number(map.hour),
    minute: Number(map.minute),
    ymd: `${map.year}-${map.month}-${map.day}`,
  };
}

export function isWeekendInNewYork(date: Date): boolean {
  const { weekday } = getNewYorkDateParts(date);
  return weekday === "Sat" || weekday === "Sun";
}

export function hasUsMarketOpened(date: Date): boolean {
  const { hour, minute } = getNewYorkDateParts(date);
  return (
    hour > US_MARKET_OPEN_HOUR ||
    (hour === US_MARKET_OPEN_HOUR && minute >= US_MARKET_OPEN_MINUTE)
  );
}

export function isUsMarketHoliday(
  date: Date,
  holidays?: HolidayYmdSet,
): boolean {
  if (!holidays || holidays.size === 0) return false;

  const { ymd } = getNewYorkDateParts(date);
  return holidays.has(ymd);
}

export function isUsMarketBusinessDay(
  date: Date,
  holidays?: HolidayYmdSet,
): boolean {
  return !isWeekendInNewYork(date) && !isUsMarketHoliday(date, holidays);
}

export function shouldRefreshDailyMarketData(
  updatedAt?: string | null,
  holidays?: HolidayYmdSet,
  now: Date = new Date(),
): boolean {
  if (!updatedAt) return true;

  if (!isUsMarketBusinessDay(now, holidays)) {
    return false;
  }

  if (!hasUsMarketOpened(now)) {
    return false;
  }

  const nowNy = getNewYorkDateParts(now);
  const updatedNy = getNewYorkDateParts(new Date(updatedAt));

  return updatedNy.ymd !== nowNy.ymd;
}
