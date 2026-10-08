# 0001. Decision log

- Status: Accepted
- Date: 2026-10-01

This file collects the decisions already made in the project. Each section is one decision. Accepted text stays as written: when a decision changes, add a new section and mark the old one `Superseded by` that section.

## 0001. Closed scope

- Status: Accepted

A personal, local app for recording a portfolio by hand. Login, a market-data API, Excel import, cost basis, gain versus cost, and dividends stay out. Market prices and unit values are typed in.

## 0002. Stack

- Status: Accepted

Docker Compose with `db`, `api`, and `web`. PostgreSQL 16, SQLAlchemy 2, and Alembic. FastAPI and Pydantic v2. React 19, TypeScript, Vite, and Tailwind. pytest with `TestClient` for the API rules.

Redis, queues, Kubernetes, and a dedicated nginx were left out. Vite serves the UI.

## 0003. Third normal form

- Status: Accepted

Balance, total, weight %, progress to target, and display conversion are queries. No table stores them. A holding or broker name is not copied onto the trade, the price, or the target.

## 0004. A position is the pair; the market price belongs to the holding

- Status: Accepted

An equity position is `instrument` + `broker`. The same holding at two brokers is two balances and one market price. The monthly price has no `broker_id`.

A trade stores a required year and an optional month. When the source only has the year, the app does not invent 1 January.

For funds, the pair is `fund` + `fiduciary` and the unit value belongs to the fund.

## 0005. A balance cannot go negative

- Status: Accepted

The pair balance is buys − sells (or subscriptions − redemptions). A partial sell lowers it, a full sell leaves it at 0, and a larger sell is rejected (`sell_exceeds_balance`; for funds, `redeem_exceeds_balance`).

Editing or deleting a trade is also rejected when the old pair or the new pair would go negative (`negative_balance`, `cannot_delete_trade`, `cannot_delete_fund_trade`). On PostgreSQL those pairs are locked with `SELECT … FOR UPDATE` before the balance is checked.

## 0006. A gap is not invented

- Status: Accepted

With no market price, the position is marked and stays out of the total. A month's price change exists only when that month and the previous calendar month both have a price. Progress to target exists only when there is a market price and a current target.

## 0007. Active and inactive

- Status: Accepted

`active` lives on the holding (or the fund), not on the broker. An inactive one does not add to the total and does not appear in weight %. Its prices and trades are kept. Turning it inactive requires a balance of 0 on every pair. A buy or subscription on an inactive one is rejected until it is active again.

## 0008. The trade price is not the market price

- Status: Accepted

The per-unit price and the commission are stored on the trade, in the holding's currency, and may be missing on old rows. When the price is set, it is greater than 0. Commission is ≥ 0. Neither writes the monthly price or the unit value, and neither enters the summary total.

## 0009. One target per month

- Status: Accepted

There is one target per holding (or fund) and per month. History is kept. The current target is the one with the latest date. Saving the same month updates that row.

## 0010. A single currency, COP

- Status: Superseded by 0011

At the start the book was COP only, the currency of those stocks, and there was no conversion.

## 0011. Quote currency and display currency

- Status: Accepted

Each holding and each fund is quoted in COP or USD. Prices, targets, the trade price, and commission are stored in that currency. Changing it is rejected once the holding already has trades, prices, or targets.

The header COP / USD toggle is display only and is stored in `localStorage`. Conversion uses that month's TRM, `cop_per_usd`: `amount_usd = amount_cop / cop_per_usd` and `amount_cop = amount_usd × cop_per_usd`. The same currency needs no rate. When that month's rate is missing, the screen shows "no FX" and does not invent one.

## 0012. The display total lives on the client

- Status: Accepted

`GET /summary` and `GET /wealth` publish each value in the position's currency. `total` and `weight_pct` are set only when every valued position shares one currency. Otherwise both are null. On `/wealth`, a module with no valued rows does not force a currency on the other.

The screen converts each value with that month's TRM (`convertMoney`, `useDisplayPositions`) and sums those amounts. The combined figure on the summary is that client sum.

Converting inside the API was left unfinished. The header currency is not a property of the portfolio, a missing rate must not be invented, and every summary call would need the FX series. Weights would also change with the chosen currency.

Consequence: another client has to repeat the conversion to show one total. A position whose month has no TRM drops out of that sum. The API `total` and the number on screen differ whenever the book mixes currencies.

## 0013. FICs do not reuse equities

- Status: Accepted

Funds and fiduciaries are a separate catalog. Subscriptions and redemptions do not use `trade` or `broker`. An exchange-listed ETF stays an `instrument`. The monthly unit value is not copied from the trade.

## 0014. The official TRM is the rate on day 1, and filled months stay

- Status: Accepted

`POST /fx-rates/official` reads the Superfinanciera series (datos.gov.co, `32sa-8pi3`) and stores the rate whose window covers the 1st of each month. When several windows cover that day, the one that starts latest wins. It is not the monthly average, and it is not an agent.

Only months that have no row yet are inserted. A rate already stored is changed by hand. A future month, or a day 1 that is not published yet, is skipped. When the source fails, the response is 502 `fx_source_unavailable` and nothing is written.

## 0015. Money is Decimal

- Status: Accepted

Quantities, prices, commissions, and rates are `Decimal` in the API and `Numeric` in PostgreSQL. The API serializes them as strings. The client sends those figures as text, so they do not pass through a JSON number.

## 0016. The schema and proper names stay fixed; the UI is translated

- Status: Accepted

Tables and columns moved to English in migration 003. Holding, broker, fund, and fiduciary names are not translated. UI copy is: Spanish, English, and Italian.

## 0017. The current month for the price banner comes from the browser

- Status: Accepted

The missing-price banner and the price grid use the year and month of the browser clock (`currentMonth` in `BannerPrecios`). They do not use the API container's UTC date.

## 0018. Rules are tested on in-memory SQLite

- Status: Accepted

The pytest suite creates the schema with `sqlite://` and `Base.metadata.create_all`. It covers the API rules (balance, mixed currencies, official TRM with the source mocked). It does not run the Alembic migrations against PostgreSQL, so it does not demonstrate the `CHECK` constraints or `Numeric` rounding on Postgres.

## 0019. The seed does not invent trades

- Status: Accepted

On startup the app loads 11 COP holdings (Ecopetrol, Celsia, ETB, GEB, Mineros, PG Argos, PG SURA, Cemagros, PF Cemagros, Grupo Argos, Grupo Sura) and 2 brokers (D Corredores, Trii). Cemagros and PF Cemagros are different holdings. The fund catalog starts empty. Opening buys are entered by the person using the app. Deleting a holding, broker, fund, or fiduciary that still has related data returns 409.

## 0020. Reserve accounts are a yearly balance, not a fund

- Status: Superseded by 0021

Pensions, severance, and the emergency fund live in this app as a third book. They are not FICs: there is no unit count and no unit value. An institution has accounts. Each account has a purpose (`official_pension`, `severance`, `voluntary_pension`, `emergency`), a currency, and a liquid flag. An emergency account starts liquid; the others start illiquid. The flag can be changed later. Changing the purpose does not flip it.

Each year has one row: the extract balance and the monthly contribution that applied that year. Saving a year updates that row and leaves the others. Years are typed one by one, including past years. The value in the wealth total is the balance of the latest year that has a row. If the current year is still empty, the previous year still counts. An account with no row stays in the summary with no value and stays out of the total. An inactive account leaves the summary. Deleting an institution that still has accounts, or an account that still has balances, returns 409. The seed does not invent institutions or balances.

The combined total still requires one currency across every valued position. A reserve in another currency makes `/wealth` total null. Equity and fund weight pies stay inside their own blocks. Reserves are their own table: account, institution, purpose, liquidity, balance, year of that balance, and monthly contribution. There is no variation chart and no target.

A reserve balance has no month. The client converts it with the December TRM of that balance year (`price_month` 12 on the position). That month is an exchange-rate anchor, not a price.

A bank account with deposits and withdrawals is out of this slice.

## 0021. A reserve balance is the value of one month

- Status: Accepted

Each account has one balance per month, typed in a year grid the same way a fund unit value is typed. An empty cell is left alone. Saving a month updates that cell and leaves the other months and years in place. A balance that was stored as a whole year before this change is kept as December of that year.

The value in the wealth total is the balance of the latest month that has a row. If the current month is empty, the previous month still counts. The client converts that balance with the TRM of that same month. The summary shows the year and the month of the balance. It no longer stores a separate monthly contribution.

## 0022. A CDT is a calculated term deposit, not a reserve

- Status: Accepted

A CDT is a fourth book. It is not an equity, a fund, or a reserve account. A bank has deposits. Each deposit stores a name, a currency, the principal, an effective annual rate, an opening date, and a maturity date. There is no monthly balance to type.

The value is principal times `(1 + rate/100) ^ (days/365)`, rounded to cents. Days run from the opening date to the earlier of today and the maturity date. Before the opening date the deposit stays in the list with no value and stays out of the total. On the opening date the value is the principal. From the maturity date onward the value stays at the full term and the deposit is liquid. Until then it is illiquid. Marking it inactive (the cash has been collected) removes it from the summary. Deleting a bank that still has deposits returns 409. A deposit itself can be deleted. The seed does not invent banks or deposits.

The client converts a valued deposit with the TRM of the month used in that calculation: the opening month, the current month, or the maturity month. Withholding tax, early withdrawal, and a nominal rate are out of this slice. The combined total still requires one currency across every valued position.

## 0023. A CDT also stores the bank certificate

- Status: Accepted

The calculated value from 0022 stays the number in the wealth total. The certificate is stored beside it: term in days, yield payment mode (`at_maturity` or `in_advance`), payment frequency, whether the yield is capitalized, last-period gross yield, net yield, and withholding. If the term is left empty, it is the number of days between the opening date and the maturity date. The form shows a name on every field. These amounts are what the bank reported. They do not replace the calculated value.

## 0024. Physical goods stay in this app, with one current value

- Status: Accepted

An apartment or a car is not a separate application. Stocks, funds, Apnea, and severance already have a value here. A good is a name, a currency, and one current value, together with the year and month of that value. Saving again replaces the value and the month. There is no history and no depreciation formula. The seed does not invent goods.

The patrimonio page reads those goods, the equity total, the fund total, each active reserve account, and the CDT total. It does not ask for Apnea or severance a second time. An inactive good leaves that page. A reserve account with no balance stays on the list and stays out of the sum. The combined total on the summary includes the goods, so the two figures match. A good in another currency makes the native total null. The screen still converts each line with the TRM of its own month.
