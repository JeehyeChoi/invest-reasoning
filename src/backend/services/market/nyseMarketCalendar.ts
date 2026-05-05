// Source: NYSE Holidays & Trading Hours screenshot/page for 2026-2028.
// Runtime market-status checks use this static calendar so FMP quota is reserved
// for company profile and classification sync.

export type NyseMarketCalendarDay = {
  date: string;
  name: string;
  kind: "closed" | "early_close";
  closeTimeEt?: "13:00";
};

export const NYSE_MARKET_CALENDAR: NyseMarketCalendarDay[] = [
  { date: "2026-01-01", name: "New Year's Day", kind: "closed" },
  { date: "2026-01-19", name: "Martin Luther King, Jr. Day", kind: "closed" },
  { date: "2026-02-16", name: "Washington's Birthday", kind: "closed" },
  { date: "2026-04-03", name: "Good Friday", kind: "closed" },
  { date: "2026-05-25", name: "Memorial Day", kind: "closed" },
  {
    date: "2026-06-19",
    name: "Juneteenth National Independence Day",
    kind: "closed",
  },
  {
    date: "2026-07-03",
    name: "Independence Day observed",
    kind: "closed",
  },
  { date: "2026-09-07", name: "Labor Day", kind: "closed" },
  { date: "2026-11-26", name: "Thanksgiving Day", kind: "closed" },
  {
    date: "2026-11-27",
    name: "Day after Thanksgiving",
    kind: "early_close",
    closeTimeEt: "13:00",
  },
  {
    date: "2026-12-24",
    name: "Christmas Eve",
    kind: "early_close",
    closeTimeEt: "13:00",
  },
  { date: "2026-12-25", name: "Christmas Day", kind: "closed" },

  { date: "2027-01-01", name: "New Year's Day", kind: "closed" },
  { date: "2027-01-18", name: "Martin Luther King, Jr. Day", kind: "closed" },
  { date: "2027-02-15", name: "Washington's Birthday", kind: "closed" },
  { date: "2027-03-26", name: "Good Friday", kind: "closed" },
  { date: "2027-05-31", name: "Memorial Day", kind: "closed" },
  {
    date: "2027-06-18",
    name: "Juneteenth National Independence Day observed",
    kind: "closed",
  },
  {
    date: "2027-07-05",
    name: "Independence Day observed",
    kind: "closed",
  },
  { date: "2027-09-06", name: "Labor Day", kind: "closed" },
  { date: "2027-11-25", name: "Thanksgiving Day", kind: "closed" },
  {
    date: "2027-11-26",
    name: "Day after Thanksgiving",
    kind: "early_close",
    closeTimeEt: "13:00",
  },
  {
    date: "2027-12-24",
    name: "Christmas Day observed",
    kind: "closed",
  },

  { date: "2028-01-17", name: "Martin Luther King, Jr. Day", kind: "closed" },
  { date: "2028-02-21", name: "Washington's Birthday", kind: "closed" },
  { date: "2028-04-14", name: "Good Friday", kind: "closed" },
  { date: "2028-05-29", name: "Memorial Day", kind: "closed" },
  {
    date: "2028-06-19",
    name: "Juneteenth National Independence Day",
    kind: "closed",
  },
  { date: "2028-07-04", name: "Independence Day", kind: "closed" },
  {
    date: "2028-07-03",
    name: "Day before Independence Day",
    kind: "early_close",
    closeTimeEt: "13:00",
  },
  { date: "2028-09-04", name: "Labor Day", kind: "closed" },
  { date: "2028-11-23", name: "Thanksgiving Day", kind: "closed" },
  {
    date: "2028-11-24",
    name: "Day after Thanksgiving",
    kind: "early_close",
    closeTimeEt: "13:00",
  },
  { date: "2028-12-25", name: "Christmas Day", kind: "closed" },
];

const NYSE_MARKET_CALENDAR_BY_DATE = new Map(
  NYSE_MARKET_CALENDAR.map((day) => [day.date, day]),
);

export function getNyseMarketCalendarDay(
  date: string,
): NyseMarketCalendarDay | null {
  return NYSE_MARKET_CALENDAR_BY_DATE.get(date) ?? null;
}

export function getNyseFullHolidayDates(): Set<string> {
  return new Set(
    NYSE_MARKET_CALENDAR.filter((day) => day.kind === "closed").map(
      (day) => day.date,
    ),
  );
}
