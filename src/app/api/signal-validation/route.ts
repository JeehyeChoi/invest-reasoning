import { NextResponse } from "next/server";
import { getFactorSignalValidationReport } from "@/backend/services/sec/companyFacts/series/signal/getFactorSignalValidationReport";
import { refreshSignalClusteringQuestionPolicies } from "@/backend/services/signal-clustering/refreshSignalClusteringQuestionPolicies";
import { FACTOR_AXIS_KEYS, type FactorAxisKey } from "@/shared/factors/axes";
import { FACTOR_KEYS, type FactorKey } from "@/shared/factors/factors";
import {
  DEFAULT_UNIVERSE_KEYS,
  isUniverseKey,
  type UniverseKey,
} from "@/shared/universe/universes";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const factor = normalizeFactorKey(url.searchParams.get("factor"));
    const axis = normalizeAxisKey(url.searchParams.get("axis"));
    const universeKeys = normalizeUniverseQuery(url.searchParams.get("universes"));

    const report = await getFactorSignalValidationReport({
      factor,
      axis,
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      universeKeys,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Signal validation fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "signal_validation_fetch_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      factor?: string;
      axis?: string;
      asOfDate?: string;
      universes?: string;
      universeKeys?: string[];
    };
    const factor = normalizeFactorKey(body.factor ?? url.searchParams.get("factor"));
    const axis = normalizeAxisKey(body.axis ?? url.searchParams.get("axis"));
    const universeKeys = Array.isArray(body.universeKeys)
      ? normalizeUniverseKeys(body.universeKeys)
      : normalizeUniverseQuery(body.universes ?? url.searchParams.get("universes"));

    const result = await refreshSignalClusteringQuestionPolicies({
      factor,
      axis,
      asOfDate: body.asOfDate ?? url.searchParams.get("asOfDate") ?? undefined,
      universeKeys,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Signal clustering policy refresh failed:", error);

    return NextResponse.json(
      { ok: false, status: "signal_clustering_policy_refresh_failed" },
      { status: 500 },
    );
  }
}

function normalizeFactorKey(value: string | null): FactorKey | undefined {
  if (!value) return undefined;
  return (FACTOR_KEYS as readonly string[]).includes(value)
    ? (value as FactorKey)
    : undefined;
}

function normalizeAxisKey(value: string | null): FactorAxisKey | undefined {
  if (!value) return undefined;
  return (FACTOR_AXIS_KEYS as readonly string[]).includes(value)
    ? (value as FactorAxisKey)
    : undefined;
}

function normalizeUniverseQuery(value: string | null): UniverseKey[] {
  if (!value) return [...DEFAULT_UNIVERSE_KEYS];

  return normalizeUniverseKeys(value.split(","));
}

function normalizeUniverseKeys(values: string[]): UniverseKey[] {
  const universeKeys = values.map((item) => item.trim()).filter(isUniverseKey);

  return universeKeys.length > 0 ? universeKeys : [...DEFAULT_UNIVERSE_KEYS];
}
