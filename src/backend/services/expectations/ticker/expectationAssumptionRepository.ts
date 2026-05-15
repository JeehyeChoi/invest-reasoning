import { db } from "@/backend/config/db";
import { DEFAULT_ASSUMPTION_SETS } from "@/backend/services/expectations/ticker/defaultAssumptionSets";
import type { ExpectationAssumptionSetRow } from "@/backend/services/expectations/ticker/types";

export async function upsertDefaultAssumptionSets(): Promise<void> {
  const values: unknown[] = [];
  const placeholders = DEFAULT_ASSUMPTION_SETS.map((set, index) => {
    const offset = index * 9;
    values.push(
      set.assumptionSetKey,
      set.name,
      set.description,
      set.horizonYears,
      set.discountRate,
      set.terminalEvSalesMultiple,
      set.terminalPeMultiple,
      set.terminalOperatingMargin,
      set.displayOrder,
    );

    return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},true,$${offset + 9})`;
  });

  await db.query(
    `
    INSERT INTO public.expectation_assumption_sets (
      assumption_set_key,
      name,
      description,
      horizon_years,
      discount_rate,
      terminal_ev_sales_multiple,
      terminal_pe_multiple,
      terminal_operating_margin,
      is_active,
      display_order
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (assumption_set_key) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      horizon_years = EXCLUDED.horizon_years,
      discount_rate = EXCLUDED.discount_rate,
      terminal_ev_sales_multiple = EXCLUDED.terminal_ev_sales_multiple,
      terminal_pe_multiple = EXCLUDED.terminal_pe_multiple,
      terminal_operating_margin = EXCLUDED.terminal_operating_margin,
      is_active = EXCLUDED.is_active,
      display_order = EXCLUDED.display_order,
      updated_at = now()
    `,
    values,
  );
}

export async function loadActiveAssumptionSets(): Promise<
  ExpectationAssumptionSetRow[]
> {
  const result = await db.query<ExpectationAssumptionSetRow>(
    `
    SELECT
      assumption_set_key,
      name,
      description,
      horizon_years,
      discount_rate,
      terminal_ev_sales_multiple,
      terminal_pe_multiple,
      terminal_operating_margin,
      is_active,
      display_order
    FROM public.expectation_assumption_sets
    WHERE is_active = true
    ORDER BY display_order ASC, assumption_set_key ASC
    `,
  );

  return result.rows;
}
