# Sell-through-first optimizer update

## Changes
- Catalog now uses all 19 products and the four categories in the supplied project sales/catalog data: Electronics, Accessories, Furniture, and Office Supplies.
- Added bundled historical sales, product catalog, and inventory data under `backend/data/`.
- The optimizer defaults to Demand (sell-through), caps fulfilled units at available inventory, and keeps below-cost-after-discount prices out of the candidate range.
- Competitor price is optional and no longer auto-filled with a fabricated value. If supplied, it informs a transparent competitive-position adjustment.
- Demand baseline uses historical product average quantity and, when sufficiently populated, region/customer-type segment averages.
- Discount is applied consistently to effective selling price for demand and financial calculations.
- UI labels the method honestly as a historical baseline plus scenario, not a fully trained competitor-aware ML forecast.

## Important limitations
- The historical data has transaction-level quantities and does not define a daily/weekly forecast horizon. Results are comparative scenarios, not guaranteed units/day.
- The dataset does not contain competitor prices, views, add-to-cart events, impressions, or conversion rates. Competitor response is therefore a disclosed heuristic, not learned behavior.
- Category elasticities are provisional assumptions. Calibrate them with controlled price tests or richer demand/conversion data before production automation.
- The current trained pickle models in the repository have category/schema mismatches with the provided 19-product catalog; this update avoids falsely claiming those models produced these recommendations.

## Run
From `backend/`: `pip install -r requirements.txt` then `python app.py`.
From project root: `npm install` then `npm run dev`.

## Electronics pricing logic update (2026-10-10)
- Electronics model is now used as a demand anchor at the current price, rather than trusting the tree model's raw predictions as a causal response curve at every candidate price.
- Candidate-price demand then follows an explicit, monotonic price-response scenario using the configured category elasticity.
- Competitor-price adjustment remains a transparent heuristic because no competitor prices were present in the training dataset; it is not represented as a learned feature.
- API diagnostics include a `selectionReason` explaining the selected objective.
- API syntax check passed. Full Flask endpoint test was not possible in the authoring environment because Flask is not installed there; install `backend/requirements.txt` before running locally.
