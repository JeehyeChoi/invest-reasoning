CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS universes (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS universe_memberships (
  id BIGSERIAL PRIMARY KEY,

  universe_key TEXT NOT NULL
    REFERENCES universes(key) ON DELETE CASCADE,

  ticker TEXT NOT NULL,
  company_name TEXT,
  sector TEXT,
  industry TEXT,
  cik TEXT,

  source TEXT NOT NULL,
  source_payload JSONB,
  effective_date DATE,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (universe_key, ticker)
);

CREATE INDEX IF NOT EXISTS idx_universe_memberships_universe_active
ON universe_memberships(universe_key, is_active);

CREATE INDEX IF NOT EXISTS idx_universe_memberships_ticker
ON universe_memberships(ticker);

CREATE INDEX IF NOT EXISTS idx_universe_memberships_cik
ON universe_memberships(cik);

DROP TRIGGER IF EXISTS set_universes_updated_at ON universes;
CREATE TRIGGER set_universes_updated_at
BEFORE UPDATE ON universes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_universe_memberships_updated_at ON universe_memberships;
CREATE TRIGGER set_universe_memberships_updated_at
BEFORE UPDATE ON universe_memberships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

INSERT INTO universes (
  key,
  name,
  provider,
  description,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'factor_proxy_etfs',
  'Factor Proxy ETFs',
  'manual',
  'Liquid ETFs used as factor proxy benchmarks for sector, style, rate, credit, commodity, and thematic exposure analysis.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

DELETE FROM universe_memberships
WHERE universe_key = 'factor_proxy_etfs';

INSERT INTO universe_memberships (
  universe_key,
  ticker,
  company_name,
  sector,
  industry,
  cik,
  source,
  source_payload,
  effective_date,
  fetched_at,
  is_active,
  created_at,
  updated_at
)
VALUES
  ('factor_proxy_etfs', 'SPY', 'SPDR S&P 500 ETF Trust', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"core_benchmark","proxy_role":"sp500"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'QQQ', 'Invesco QQQ Trust', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"core_benchmark","proxy_role":"nasdaq_100"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'DIA', 'SPDR Dow Jones Industrial Average ETF Trust', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"core_benchmark","proxy_role":"dow_jones_industrial_average"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'IWM', 'iShares Russell 2000 ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"core_size","proxy_role":"small_cap_equity"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLY', 'Consumer Discretionary Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"consumer_discretionary"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLP', 'Consumer Staples Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"consumer_staples"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLK', 'Technology Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"technology"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLF', 'Financial Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"financials"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLV', 'Health Care Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"healthcare"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLE', 'Energy Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"energy"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLI', 'Industrial Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"industrials"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLB', 'Materials Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"materials"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLU', 'Utilities Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"utilities"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLRE', 'Real Estate Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"real_estate"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XLC', 'Communication Services Select Sector SPDR Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"sector","proxy_role":"communication_services"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'IWF', 'iShares Russell 1000 Growth ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"growth"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'IWD', 'iShares Russell 1000 Value ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"value"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'MTUM', 'iShares MSCI USA Momentum Factor ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"momentum"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'QUAL', 'iShares MSCI USA Quality Factor ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"quality"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'USMV', 'iShares MSCI USA Min Vol Factor ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"minimum_volatility"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'VLUE', 'iShares MSCI USA Value Factor ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"value_factor"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SPHB', 'Invesco S&P 500 High Beta ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"high_beta"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SPLV', 'Invesco S&P 500 Low Volatility ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"style_factor","proxy_role":"low_volatility"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'TLT', 'iShares 20+ Year Treasury Bond ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"rate_credit","proxy_role":"long_duration_treasury"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'IEF', 'iShares 7-10 Year Treasury Bond ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"rate_credit","proxy_role":"intermediate_treasury"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SHY', 'iShares 1-3 Year Treasury Bond ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"rate_credit","proxy_role":"short_treasury"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'HYG', 'iShares iBoxx $ High Yield Corporate Bond ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"rate_credit","proxy_role":"high_yield_credit"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'LQD', 'iShares iBoxx $ Investment Grade Corporate Bond ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"rate_credit","proxy_role":"investment_grade_credit"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'KRE', 'SPDR S&P Regional Banking ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"rate_credit","proxy_role":"regional_banks"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'GLD', 'SPDR Gold Shares', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"commodity_inflation","proxy_role":"gold"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SLV', 'iShares Silver Trust', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"commodity_inflation","proxy_role":"silver"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'DBC', 'Invesco DB Commodity Index Tracking Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"commodity_inflation","proxy_role":"broad_commodities"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'USO', 'United States Oil Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"commodity_inflation","proxy_role":"oil"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'UNG', 'United States Natural Gas Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"commodity_inflation","proxy_role":"natural_gas"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XOP', 'SPDR S&P Oil & Gas Exploration & Production ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"energy","proxy_role":"oil_gas_exploration_production"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'OIH', 'VanEck Oil Services ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"energy","proxy_role":"oil_services"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'GDX', 'VanEck Gold Miners ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"commodity_inflation","proxy_role":"gold_miners"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'XRT', 'SPDR S&P Retail ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"consumer_cyclical","proxy_role":"retail"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'IYT', 'iShares U.S. Transportation ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"consumer_cyclical","proxy_role":"transportation"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'ITA', 'iShares U.S. Aerospace & Defense ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"defense_infrastructure","proxy_role":"aerospace_defense"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'PPA', 'Invesco Aerospace & Defense ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"defense_infrastructure","proxy_role":"aerospace_defense"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'PAVE', 'Global X U.S. Infrastructure Development ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"defense_infrastructure","proxy_role":"infrastructure"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'GRID', 'First Trust Nasdaq Clean Edge Smart Grid Infrastructure Index Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"power_grid","proxy_role":"smart_grid_power_infrastructure"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SMH', 'VanEck Semiconductor ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"ai_infrastructure","proxy_role":"semiconductors"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SOXX', 'iShares Semiconductor ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"ai_infrastructure","proxy_role":"semiconductors"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'AIQ', 'Global X Artificial Intelligence & Technology ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"artificial_intelligence","proxy_role":"ai_technology"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'BOTZ', 'Global X Robotics & Artificial Intelligence ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"artificial_intelligence","proxy_role":"robotics_ai"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'CIBR', 'First Trust Nasdaq Cybersecurity ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"artificial_intelligence","proxy_role":"cybersecurity_ai_adjacent"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'ROBO', 'ROBO Global Robotics & Automation Index ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"robotics_automation","proxy_role":"robotics_automation"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'IGV', 'iShares Expanded Tech-Software Sector ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"ai_software","proxy_role":"software_platforms"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'SKYY', 'First Trust Cloud Computing ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"ai_software","proxy_role":"cloud_computing"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'WCLD', 'WisdomTree Cloud Computing Fund', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"ai_software","proxy_role":"cloud_software"}'::jsonb, NULL, NOW(), true, NOW(), NOW()),
  ('factor_proxy_etfs', 'QTUM', 'Defiance Quantum ETF', NULL, NULL, NULL, 'manual_factor_proxy_etfs', '{"proxy_group":"quantum","proxy_role":"quantum_computing"}'::jsonb, NULL, NOW(), true, NOW(), NOW());
