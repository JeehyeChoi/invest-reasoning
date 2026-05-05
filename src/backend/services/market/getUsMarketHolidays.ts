// backend/services/market/getUsMarketHolidays.ts

import {
  getNyseFullHolidayDates,
  getNyseMarketCalendarDay,
} from "@/backend/services/market/nyseMarketCalendar";

export type UsMarketState =
  | "holiday"
  | "weekend"
  | "preopen"
  | "open"
  | "early_close"
  | "closed";

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
  return getNyseFullHolidayDates();
}

export async function getUsMarketState(): Promise<{
  state: UsMarketState;
  label: string;
  nowNy: string;
}> {
  const { ymd, weekday, minutesSinceMidnight, nowNy } = getNewYorkNowParts();
  const calendarDay = getNyseMarketCalendarDay(ymd);

  if (calendarDay?.kind === "closed") {
    return {
      state: "holiday",
      label: `Market is closed today (${calendarDay.name})`,
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
  const regularCloseMinutes = 16 * 60;
  const isEarlyClose = calendarDay?.kind === "early_close";
  const closeMinutes = isEarlyClose ? 13 * 60 : regularCloseMinutes;

  if (minutesSinceMidnight < openMinutes) {
    return {
      state: "preopen",
      label: isEarlyClose
        ? `Market opens soon; early close at 1:00 PM ET (${calendarDay.name})`
        : "Market opens soon",
      nowNy,
    };
  }

  if (minutesSinceMidnight < closeMinutes) {
    return {
      state: isEarlyClose ? "early_close" : "open",
      label: isEarlyClose
        ? `Market is open; early close at 1:00 PM ET (${calendarDay.name})`
        : "Market is open",
      nowNy,
    };
  }

  return {
    state: "closed",
    label: isEarlyClose
      ? `Market closed early today at 1:00 PM ET (${calendarDay.name})`
      : "Market is closed",
    nowNy,
  };
}
