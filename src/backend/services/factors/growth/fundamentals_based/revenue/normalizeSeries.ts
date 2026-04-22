type SeriesPoint = {
  end: string;
  filed: string | null;
  val: number;
  periodType?: string;
  frame?: string | null;
};

export type NormalizedSeriesPoint = {
  end: string;
  filed: string | null;
  val: number;
};

export function normalizeSeries(
  series: SeriesPoint[],
): NormalizedSeriesPoint[] {
  if (!series || series.length === 0) {
    return [];
  }

  const valid = series.filter((point) => Number.isFinite(point.val));

  const grouped = new Map<string, SeriesPoint[]>();

  for (const point of valid) {
    if (!grouped.has(point.end)) {
      grouped.set(point.end, []);
    }
    grouped.get(point.end)!.push(point);
  }

  const deduped: NormalizedSeriesPoint[] = [];

  for (const [, points] of grouped.entries()) {
    const sortedByFiled = [...points].sort((a, b) => {
      const aTime = a.filed ? new Date(a.filed).getTime() : 0;
      const bTime = b.filed ? new Date(b.filed).getTime() : 0;
      return bTime - aTime;
    });

    const chosen = sortedByFiled[0];

    deduped.push({
      end: chosen.end,
      filed: chosen.filed,
      val: Number(chosen.val),
    });
  }

  deduped.sort((a, b) => {
    return new Date(a.end).getTime() - new Date(b.end).getTime();
  });

  return deduped;
}
