# Retail Price Optimizer — local multi-retailer status

## Implemented in this pass
- Removed the old mock-data Dashboard and its mock-data source; it is no longer part of the app.
- Inventory page now reads tenant-scoped product stock and imported sales through `/api/inventory`; no generated stock, reorder values, or lead times are shown.
- Analytics page now reads tenant-scoped imported sales through `/api/analytics`; monthly revenue, units by category, top products, and KPIs are computed from saved rows. Empty sales history produces an empty state, not sample charts.
- Runtime price optimization and What-If no longer use the bundled project catalog, bundled historical sales, or bundled trained model as a retailer's baseline.
- What-If and price optimization require at least five sales-history rows for the selected product. If history is insufficient, the API returns an explicit error instead of inventing a demand forecast.
- Product current price, unit cost, and stock are read from the authenticated tenant's database. Discount and minimum-margin checks run server-side.
- Retailer data is tenant-scoped in product, sales, inventory, analytics, recommendation, and What-If paths.
- CSV templates contain headers only, with no sample product/sales/competitor rows.
- SQLite runtime data is excluded from version control and must not be included in a distributable ZIP.

## Important limitations
- **Not fully verified:** Python syntax, SQLite schema creation, and JSX syntax parsing passed. Full backend API integration tests could not run because Flask/Flask-CORS are not installed in this environment and package downloads are unavailable. Frontend production build could not run because Vite is absent and npm package downloads are unavailable.
- Demand response is still an explicit category elasticity scenario applied to the shop's own observed average transaction quantity. It is not a causal demand model or a trained competitor-aware model. The competitor-price effect is a transparent heuristic.
- At least five rows is a basic minimum only, not a guarantee of statistical reliability. Sales data must contain comparable prices, quantities, and dates.
- Competitor price observations are accepted manually through the API; there is no live competitor scraping/feed or UI entry workflow yet.
- Recommendation approval updates only the local product record; it does not change a live e-commerce storefront or POS.
- Analytics gross profit is an estimate using the current saved unit cost; historical cost-at-sale is not captured.
- Local-first prototype is not security-certified or production-hardened.

## First run
1. Create a Python virtual environment and install `backend/requirements.txt`.
2. Run `python backend/app.py` from the project root (or `python app.py` from `backend`).
3. Install frontend dependencies with `npm ci`, then run `npm run dev`.
4. Create the initial admin with a unique username and a password of at least 12 characters.
5. Admin creates retailer accounts. Each retailer adds/imports their own products and imports their own sales CSV.
6. Import sales columns `sku,date,quantity,unitPrice`; SKU must exist in that retailer's own catalog. Use `YYYY-MM-DD` dates.

## Verification required before a final release ZIP
- [ ] Install backend dependencies and run API tests on a clean database.
- [ ] `npm ci` and `npm run build`.
- [ ] Verify admin setup, login, account creation, and inactive-account behavior.
- [ ] Verify two retailers cannot access each other's products, sales, analytics, inventory, competitors, or recommendations.
- [ ] Verify CSV import errors, five-row simulation minimum, price/margin/discount guardrails, and zero-stock behavior.
- [ ] Verify pending/approve/reject workflow and audit log.
- [ ] Confirm no tenant database, test credentials, or sample data is shipped in the ZIP.

## Local CORS troubleshooting update
- Fixed the development CORS allowlist to accept localhost/127.0.0.1 origins on whichever local port Vite selects (e.g. `localhost:5176` when `5173` is busy).
- Restart the Flask backend after updating. This change addresses the browser CORS preflight error; it does not replace starting the backend or installing its requirements.
