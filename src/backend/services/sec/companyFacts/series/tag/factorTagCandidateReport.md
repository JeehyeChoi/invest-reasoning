# Factor Tag Candidate Report

Generated on 2026-05-04 from the current local SEC company-facts raw universe.

This report captures raw SEC tag candidates before promoting them into
`tagMeta.ts`. It is intentionally a discovery report, not an active mapping.

## Scope

The discovery universe is not the full SEC universe. It is limited to the
currently ingested and classified ticker universe.

```text
raw_ciks             504
mapped_tickers       507
classified_tickers   507
classified_raw_ciks  504
```

Filters used for candidate discovery:

```text
taxonomy = us-gaap
period end >= 2018-01-01
period end <= current_date
tag not already captured in sec_companyfact_tag_series
company must be mapped through ticker_identities
company must have sector classification
```

## Current Revenue Baseline

Revenue is already organized with `tagFamily` in `tagMeta.ts`.

```text
revenue_core
revenue_sales_split
revenue_financial_net
revenue_real_estate
revenue_utility
revenue_healthcare
```

This is the reference pattern for sector-aware tags. The hard part is not adding
new tag families. The hard part is deciding whether a discovered tag is a true
variant of an existing metric or a separate sector-specific metric.

## Promotion Rule

Do not add sector-specific tags directly to `tagMeta.ts` unless the semantic role
is clear.

Candidate outcomes:

```text
existing metric variant
new sector-aware metric
factor-only evidence candidate
ignore/noisy disclosure tag
```

## High-Signal Sector Candidates

### Energy

These tags appear concentrated in Energy and oil/gas industries. Most are not
simple revenue variants. They are better candidates for `energy_linked`,
`commodity_linked`, or capex/reserve/activity-specific metrics.

```text
CapitalizedExploratoryWellCosts
ExplorationExpense
CapitalizedCostsOilAndGasProducingActivitiesGross
CapitalizedCostsOilAndGasProducingActivitiesNet
CapitalizedCostsAccumulatedDepreciationDepletionAmortizationAndValuationAllowanceForRelatingToOilAndGasProducingActivities
CostsIncurredAcquisitionOfUnprovedOilAndGasProperties
CostsIncurredAcquisitionOfOilAndGasPropertiesWithProvedReserves
CapitalizedExploratoryWellCostChargedToExpense1
CapitalizedExploratoryWellCostAdditionsPendingDeterminationOfProvedReserves
CostOfPurchasedOilAndGas
InventoryCrudeOilProductsAndMerchandise
CrudeOilAndNaturalGasLiquids
```

Industry-specific examples:

```text
Energy / Oil & Gas Exploration & Production
  CapitalizedExploratoryWellCosts                 8 tickers, 876 rows
  ExplorationExpense                              8 tickers, 721 rows
  CapitalizedCostsOilAndGasProducingActivitiesGross 8 tickers, 239 rows
  CapitalizedCostsOilAndGasProducingActivitiesNet   8 tickers, 239 rows

Energy / Oil & Gas Integrated
  CapitalizedExploratoryWellCosts                 2 tickers, 217 rows
  ExplorationExpense                              2 tickers, 194 rows

Energy / Oil & Gas Midstream
  CostOfPurchasedOilAndGas                        2 tickers, 6 rows

Energy / Oil & Gas Refining & Marketing
  InventoryCrudeOilProductsAndMerchandise         2 tickers, 364 rows
  CrudeOilAndNaturalGasLiquids                    2 tickers, 302 rows
```

Recommended next step:

```text
Keep these in candidate status.
Do not merge into generic revenue.
Evaluate as energy_linked or commodity_linked metric sources.
```

### Utilities

Utilities has regulated revenue and gas inventory/expense tags. Some may extend
the existing revenue family; others are operating-cost or inventory signals.

```text
GasDomesticRegulatedRevenue
UnregulatedOperatingRevenue
RegulatedOperatingRevenueGas
RegulatedOperatingRevenue
EnergyRelatedInventoryNaturalGasInStorage
EnergyRelatedInventoryGasStoredUnderground
UtilitiesOperatingExpenseGasAndPetroleumPurchased
CostOfNaturalGasPurchases
RegulatedEntityOtherAssetsNoncurrent
```

Industry-specific examples:

```text
Utilities / Regulated Electric
  GasDomesticRegulatedRevenue                     7 tickers, 13 rows
  UnregulatedOperatingRevenue                     5 tickers, 482 rows
  EnergyRelatedInventoryNaturalGasInStorage       4 tickers, 666 rows
  EnergyRelatedInventoryGasStoredUnderground      4 tickers, 586 rows
  UtilitiesOperatingExpenseGasAndPetroleumPurchased 4 tickers, 296 rows

Utilities / Regulated Gas
  RegulatedOperatingRevenue                       2 tickers, 101 rows
```

Recommended next step:

```text
Review revenue-like tags separately from inventory/expense tags.
Potentially add utility revenue families only after checking overlap with
RegulatedAndUnregulatedOperatingRevenue and ElectricUtilityRevenue.
```

### Communication Services

Entertainment/media tags are concentrated around film and program rights. These
are not generic revenue tags; they are content asset and obligation candidates.

```text
ProgramRightsObligationsCurrent
FilmMonetizedOnItsOwnCapitalizedCost
FilmCosts
FilmMonetizedInFilmGroupCapitalizedCost
FilmMonetizedInFilmGroupCapitalizedCostProduction
DirectToTelevisionFilmCostsReleased
TheatricalFilmCostsCompletedAndNotReleased
TheatricalFilmCostsReleased
DirectToTelevisionFilmCostsCompletedAndNotReleased
```

Industry-specific examples:

```text
Communication Services / Entertainment
  ProgramRightsObligationsCurrent                 6 tickers, 330 rows
  FilmMonetizedOnItsOwnCapitalizedCost            5 tickers, 308 rows
  FilmMonetizedInFilmGroupCapitalizedCost         3 tickers, 194 rows
  FilmCosts                                       3 tickers, 170 rows
```

Recommended next step:

```text
Keep as sector-specific candidate metrics.
Potential fit: consumer_linked, cyclical, or content-asset quality.
```

### Consumer Cyclical

These tags identify restaurant, franchise, casino, lodging, loyalty, and
homebuilding patterns. They are useful for consumer-strength or cyclical
factor candidates, but many are industry-specific operating indicators rather
than general financial metrics.

```text
NumberOfRestaurants
FranchiseRevenue
FranchiseCosts
CasinoRevenue
CasinoExpenses
CustomerLoyaltyProgramLiabilityCurrent
CustomerLoyaltyProgramLiabilityNoncurrent
IncreaseDecreaseInCustomerLoyaltyProgramLiability
HomeBuildingRevenue
HomeBuildingCosts
```

Industry-specific examples:

```text
Consumer Cyclical / Restaurants
  NumberOfRestaurants                             3 tickers, 321 rows
  FranchiseRevenue                                2 tickers, 13 rows
  FranchiseCosts                                  2 tickers, 9 rows

Consumer Cyclical / Gambling, Resorts & Casinos
  CasinoExpenses                                  3 tickers, 8 rows
  CasinoRevenue                                   3 tickers, 8 rows

Consumer Cyclical / Residential Construction
  HomeBuildingRevenue                             2 tickers, 13 rows
  HomeBuildingCosts                               2 tickers, 13 rows

Consumer Cyclical / Travel Lodging
  CustomerLoyaltyProgramLiabilityCurrent          2 tickers, 14 rows
  CustomerLoyaltyProgramLiabilityNoncurrent       2 tickers, 14 rows
  FranchiseRevenue                                2 tickers, 4 rows
```

Recommended next step:

```text
Keep as factor tag candidates.
Do not promote into generic revenue without metric-specific validation.
```

## Factor Keyword Candidate Snapshot

This query is intentionally broad and contains noise. It should be used to find
leads, not to promote tags automatically.

```text
commodity_linked
  UnrealizedGainLossOnDerivativesAndCommodityContracts 16 tickers, 477 rows
  CommodityContractAssetCurrent                         3 tickers, 273 rows
  IncreaseDecreaseInCommodityContractAssetsAndLiabilities 3 tickers, 147 rows

consumer_linked
  CustomerLoyaltyProgramLiabilityCurrent                8 tickers, 130 rows
  FranchiseRevenue                                      5 tickers, 20 rows
  NumberOfRestaurants                                   3 tickers, 321 rows
  CasinoRevenue                                         3 tickers, 8 rows
  CasinoExpenses                                        3 tickers, 8 rows
  HomeBuildingRevenue                                   2 tickers, 13 rows

energy_linked
  ExplorationExpense                                    11 tickers, 1008 rows
  CapitalizedExploratoryWellCosts                       10 tickers, 1093 rows
  CapitalizedCostsOilAndGasProducingActivitiesNet        8 tickers, 239 rows

liquidity_sensitive
  AccountsPayableCurrent                              363 tickers, 65972 rows
  AccountsReceivableNetCurrent                         339 tickers, 60054 rows
  InventoryNet                                         305 tickers, 59065 rows

rate_sensitive
  InterestPaidNet                                      447 tickers, 19312 rows
  LongTermDebt                                         365 tickers, 39300 rows
  ProceedsFromIssuanceOfLongTermDebt                   315 tickers, 12789 rows
```

## Notes

Some keyword results are broad accounting disclosures rather than factor-specific
signals. For example, hedge/derivative tags appear across many sectors and should
not automatically become `inflation_hedge` tags without additional logic.

Sector-aware promotion should follow this order:

```text
candidate report
semantic review
metric definition
tagMeta promotion
series build validation
feature interpretation update
```
