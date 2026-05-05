CREATE TABLE IF NOT EXISTS public.ticker_factor_signal_definitions (
  id BIGSERIAL PRIMARY KEY,

  model_key TEXT NOT NULL,
  model_version TEXT NOT NULL,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,

  signal_key TEXT NOT NULL,
  signal_label TEXT NOT NULL,
  signal_description TEXT,

  priority INTEGER NOT NULL DEFAULT 100,

  selection_rules JSONB NOT NULL,
  evidence_rules JSONB NOT NULL,
  confidence_rules JSONB NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_signal_definitions UNIQUE (
    model_key,
    model_version,
    factor,
    axis,
    signal_key
  ),

  CONSTRAINT chk_tfsd_selection_rules_object
  CHECK (jsonb_typeof(selection_rules) = 'object'),

  CONSTRAINT chk_tfsd_evidence_rules_object
  CHECK (jsonb_typeof(evidence_rules) = 'object'),

  CONSTRAINT chk_tfsd_confidence_rules_object
  CHECK (jsonb_typeof(confidence_rules) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_tfsd_active_lookup
ON public.ticker_factor_signal_definitions (
  factor,
  axis,
  is_active,
  priority
);

CREATE INDEX IF NOT EXISTS idx_tfsd_model_lookup
ON public.ticker_factor_signal_definitions (
  model_key,
  model_version,
  factor,
  axis
);

INSERT INTO public.ticker_factor_signal_definitions (
  model_key,
  model_version,
  factor,
  axis,
  signal_key,
  signal_label,
  signal_description,
  priority,
  selection_rules,
  evidence_rules,
  confidence_rules
)
VALUES
  (
    'factor_signal',
    'v0',
    'growth',
    'fundamentals_based',
    'turnaround_growth',
    'Turnaround Growth',
    'Sign-sensitive growth metrics are moving out of loss or deterioration.',
    10,
    '{"all":[{"featureKey":"turnaroundMomentum","aggregate":"latest_median","operator":">=","value":0.5,"minObservedMetricCount":1}]}'::jsonb,
    '{"supportingFeatureKeys":["turnaroundMomentum"],"maxPresentedItems":4}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":3}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'growth',
    'fundamentals_based',
    'accelerating_growth',
    'Accelerating Growth',
    'Durable growth is positive and recent YoY momentum is improving.',
    20,
    '{"all":[{"featureKey":"durableGrowth","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":2},{"featureKey":"acceleration","aggregate":"latest_median","operator":">=","value":0.02,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["durableGrowth","acceleration","latestGrowth"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'growth',
    'fundamentals_based',
    'durable_growth',
    'Durable Growth',
    'Trailing growth is positive across multiple growth metrics.',
    30,
    '{"all":[{"featureKey":"durableGrowth","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["durableGrowth","latestGrowth"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'growth',
    'fundamentals_based',
    'tentative_growth',
    'Tentative Growth',
    'Latest growth is positive, but durable confirmation is weaker or incomplete.',
    40,
    '{"all":[{"featureKey":"latestGrowth","aggregate":"latest_median","operator":">=","value":0.03,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["latestGrowth"],"contextFeatureKeys":["durableGrowth","acceleration"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'growth',
    'fundamentals_based',
    'contracting_growth',
    'Contracting Growth',
    'Recent growth is negative across multiple growth metrics.',
    50,
    '{"all":[{"featureKey":"latestGrowth","aggregate":"latest_median","operator":"<=","value":-0.03,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["latestGrowth","durableGrowth"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'growth',
    'fundamentals_based',
    'stable_or_mixed_growth',
    'Stable or Mixed Growth',
    'Growth features are not strong enough for a directional growth signal.',
    100,
    '{"default":true}'::jsonb,
    '{"supportingFeatureKeys":["latestGrowth","durableGrowth","acceleration","turnaroundMomentum"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'quality',
    'fundamentals_based',
    'improving_quality',
    'Improving Quality',
    'Profitability quality features are improving or turning around.',
    10,
    '{"any":[{"featureKey":"turnaroundMomentum","aggregate":"latest_median","operator":">=","value":0.5,"minObservedMetricCount":1},{"featureKey":"qualityTrendSupport","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["turnaroundMomentum","qualityTrendSupport","qualityConsistency"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":3}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'quality',
    'fundamentals_based',
    'consistent_quality',
    'Consistent Quality',
    'Quality consistency is high across observed profitability metrics.',
    20,
    '{"all":[{"featureKey":"qualityConsistency","aggregate":"latest_median","operator":">=","value":0.75,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["qualityConsistency","qualityTrendSupport"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":3}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'quality',
    'fundamentals_based',
    'deteriorating_quality',
    'Deteriorating Quality',
    'Profitability quality features are weakening or deteriorating.',
    30,
    '{"any":[{"featureKey":"turnaroundMomentum","aggregate":"latest_median","operator":"<=","value":-0.5,"minObservedMetricCount":1},{"featureKey":"qualityTrendSupport","aggregate":"latest_median","operator":"<=","value":-0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["turnaroundMomentum","qualityTrendSupport","qualityConsistency"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":3}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'quality',
    'fundamentals_based',
    'mixed_quality',
    'Mixed Quality',
    'Quality features are incomplete or mixed.',
    100,
    '{"default":true}'::jsonb,
    '{"supportingFeatureKeys":["qualityConsistency","qualityTrendSupport","turnaroundMomentum"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":3}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'income',
    'fundamentals_based',
    'reliable_income_distribution',
    'Reliable Income Distribution',
    'Income distribution consistency is high across observed payout metrics.',
    10,
    '{"all":[{"featureKey":"incomeDistributionConsistency","aggregate":"latest_median","operator":">=","value":0.75,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["incomeDistributionConsistency","incomeDistributionTrend","incomeDistributionMomentum"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'income',
    'fundamentals_based',
    'improving_income_distribution',
    'Improving Income Distribution',
    'Income distribution trend or momentum is improving.',
    20,
    '{"any":[{"featureKey":"incomeDistributionTrend","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":2},{"featureKey":"incomeDistributionMomentum","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["incomeDistributionTrend","incomeDistributionMomentum","incomeDistributionConsistency"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'income',
    'fundamentals_based',
    'weakening_income_distribution',
    'Weakening Income Distribution',
    'Income distribution trend or momentum is weakening.',
    30,
    '{"any":[{"featureKey":"incomeDistributionTrend","aggregate":"latest_median","operator":"<=","value":-0.05,"minObservedMetricCount":2},{"featureKey":"incomeDistributionMomentum","aggregate":"latest_median","operator":"<=","value":-0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["incomeDistributionTrend","incomeDistributionMomentum","incomeDistributionConsistency"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'income',
    'fundamentals_based',
    'mixed_income_distribution',
    'Mixed Income Distribution',
    'Income distribution features are incomplete or mixed.',
    100,
    '{"default":true}'::jsonb,
    '{"supportingFeatureKeys":["incomeDistributionConsistency","incomeDistributionTrend","incomeDistributionMomentum"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'defensive',
    'fundamentals_based',
    'strong_defensive_profile',
    'Strong Defensive Profile',
    'Defensive stability or balance-sheet relief features are strong.',
    10,
    '{"any":[{"featureKey":"defensiveStability","aggregate":"latest_median","operator":">=","value":0.75,"minObservedMetricCount":2},{"featureKey":"defensiveBurdenRelief","aggregate":"latest_median","operator":">=","value":0.03,"minObservedMetricCount":1},{"featureKey":"defensiveBurdenContractionConsistency","aggregate":"latest_median","operator":">=","value":0.75,"minObservedMetricCount":1}]}'::jsonb,
    '{"supportingFeatureKeys":["defensiveStability","defensiveBurdenRelief","defensiveBurdenContractionConsistency","defensiveBufferTrend"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'defensive',
    'fundamentals_based',
    'defensive_pressure',
    'Defensive Pressure',
    'Defensive buffer or burden features are weakening.',
    20,
    '{"any":[{"featureKey":"defensiveBufferTrend","aggregate":"latest_median","operator":"<=","value":-0.05,"minObservedMetricCount":2},{"featureKey":"defensiveBurdenRelief","aggregate":"latest_median","operator":"<=","value":-0.03,"minObservedMetricCount":1},{"featureKey":"defensiveShockAbsorption","aggregate":"latest_median","operator":"<=","value":0.25,"minObservedMetricCount":1}]}'::jsonb,
    '{"supportingFeatureKeys":["defensiveBufferTrend","defensiveBurdenRelief","defensiveShockAbsorption"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'defensive',
    'fundamentals_based',
    'mixed_defensive_profile',
    'Mixed Defensive Profile',
    'Defensive features are incomplete or mixed.',
    100,
    '{"default":true}'::jsonb,
    '{"supportingFeatureKeys":["defensiveStability","defensiveBufferTrend","defensiveShockAbsorption","defensiveBurdenRelief","defensiveBurdenTrendRelief","defensiveBurdenContractionConsistency"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'capex_cycle',
    'fundamentals_based',
    'capex_accelerating',
    'CapEx Accelerating',
    'CapEx cycle acceleration is positive across observed investment metrics.',
    10,
    '{"all":[{"featureKey":"capexCycleAcceleration","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":1}]}'::jsonb,
    '{"supportingFeatureKeys":["capexCycleAcceleration","capexCycleRamp","capexCycleTrendStretch"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":2}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'capex_cycle',
    'fundamentals_based',
    'capex_ramping',
    'CapEx Ramping',
    'CapEx ramp features are positive across observed investment metrics.',
    20,
    '{"all":[{"featureKey":"capexCycleRamp","aggregate":"latest_median","operator":">=","value":0.01,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["capexCycleRamp","capexCycleAcceleration","capexCycleTrendStretch"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'capex_cycle',
    'fundamentals_based',
    'capex_pullback',
    'CapEx Pullback',
    'CapEx ramp features are negative across observed investment metrics.',
    30,
    '{"all":[{"featureKey":"capexCycleRamp","aggregate":"latest_median","operator":"<=","value":-0.01,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["capexCycleRamp","capexCycleAcceleration","capexCycleTrendStretch"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'capex_cycle',
    'fundamentals_based',
    'stable_capex_cycle',
    'Stable CapEx Cycle',
    'CapEx cycle features are incomplete, flat, or mixed.',
    100,
    '{"default":true}'::jsonb,
    '{"supportingFeatureKeys":["capexCycleRamp","capexCycleAcceleration","capexCycleTrendStretch"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'energy_linked',
    'fundamentals_based',
    'energy_exposure_ramping',
    'Energy Exposure Ramping',
    'Energy-linked revenue, activity, asset, or inventory metrics are increasing across observed metrics.',
    10,
    '{"all":[{"featureKey":"energyExposureRamp","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["energyExposureRamp","energyExposureAcceleration","energyExposureStretch"],"contextFeatureKeys":["energyCostPressure"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'energy_linked',
    'fundamentals_based',
    'energy_asset_or_inventory_build',
    'Energy Asset or Inventory Build',
    'Energy-linked asset base or commodity inventory is elevated versus recent history.',
    20,
    '{"all":[{"featureKey":"energyExposureStretch","aggregate":"latest_median","operator":">=","value":0.10,"minObservedMetricCount":1}]}'::jsonb,
    '{"supportingFeatureKeys":["energyExposureStretch","energyExposureRamp"],"contextFeatureKeys":["energyExposureAcceleration"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":3}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'energy_linked',
    'fundamentals_based',
    'energy_cost_pressure',
    'Energy Cost Pressure',
    'Energy input costs are rising, indicating margin pressure or pass-through risk.',
    30,
    '{"all":[{"featureKey":"energyCostPressure","aggregate":"latest_median","operator":">=","value":0.05,"minObservedMetricCount":1}]}'::jsonb,
    '{"supportingFeatureKeys":["energyCostPressure","energyCostAcceleration","energyCostStretch"],"contextFeatureKeys":["energyExposureRamp"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":2}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'energy_linked',
    'fundamentals_based',
    'energy_exposure_fading',
    'Energy Exposure Fading',
    'Energy-linked activity, revenue, asset, or inventory metrics are declining across observed metrics.',
    40,
    '{"all":[{"featureKey":"energyExposureRamp","aggregate":"latest_median","operator":"<=","value":-0.05,"minObservedMetricCount":2}]}'::jsonb,
    '{"supportingFeatureKeys":["energyExposureRamp","energyExposureAcceleration","energyExposureStretch"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":2,"fullConfidenceMetricCount":4}'::jsonb
  ),
  (
    'factor_signal',
    'v0',
    'energy_linked',
    'fundamentals_based',
    'mixed_energy_exposure',
    'Mixed Energy Exposure',
    'Energy-linked features are incomplete, flat, or mixed.',
    100,
    '{"default":true}'::jsonb,
    '{"supportingFeatureKeys":["energyExposureRamp","energyExposureAcceleration","energyExposureStretch","energyCostPressure","energyCostAcceleration","energyCostStretch"],"maxPresentedItems":5}'::jsonb,
    '{"minObservedMetricCount":1,"fullConfidenceMetricCount":4}'::jsonb
  )
ON CONFLICT (
  model_key,
  model_version,
  factor,
  axis,
  signal_key
)
DO UPDATE SET
  signal_label = EXCLUDED.signal_label,
  signal_description = EXCLUDED.signal_description,
  priority = EXCLUDED.priority,
  selection_rules = EXCLUDED.selection_rules,
  evidence_rules = EXCLUDED.evidence_rules,
  confidence_rules = EXCLUDED.confidence_rules,
  is_active = true,
  updated_at = now();
