# BokPrism

Explore financial data for all Swedish companies. Built on open data from [Bolagsverket](https://vardefulla-datamangder.bolagsverket.se/arsredovisningar/).

## What's in the database

| | |
|---|---|
| Companies | 537,349 |
| Annual reports | 1,762,986 |
| Financial data points | 87,673,297 |
| Board members & auditors | 509,974 |
| Years covered | 2017–2026 |

All data is parsed from iXBRL (inline XBRL) annual reports using the Swedish GAAP taxonomy.

The parser enforces sanity bounds to reject clearly impossible values (filer errors — e.g., dates typed in employee fields, percentages missing scale attributes). Post-processing removes employee counts that fail a revenue-per-employee cross-check. Top rankings verified against known Swedish corporations.

## Features

- **Instant search** by company name or org number (FTS5, sub-millisecond)
- **Company detail pages** with interactive charts, full income statement, balance sheet, and equity changes over time
- **Board member connections** — click a person to see every company they're connected to
- **Rankings** — sort all companies by revenue, profit, assets, equity, employees, or equity ratio
- **Trend indicators** — see year-over-year changes at a glance

## Tech stack

Next.js 16, TypeScript, SQLite (13 GB), Tailwind CSS, Recharts. Deployed with Docker and Caddy.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Get the database

The database is too large for git (13 GB). Either build it from scratch or transfer from another machine.

**Build from scratch** (downloads ~100 GB of zip files, takes ~7 hours):

```bash
npm run ingest
```

**Transfer from another machine:**

```bash
mkdir -p data
scp source-machine:~/repos/bokprism/data/bokprism.db data/bokprism.db
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

101 tests covering utilities, components, and the iXBRL parser.

## Deploy

See [infra/README.md](infra/README.md) for production deployment with Docker behind a shared Caddy reverse proxy ([caddy-infra](https://github.com/ClaudeCarlsson/caddy-infra)).

```bash
cd infra
docker compose up -d
```

## Data source

All financial data comes from Bolagsverket's free "vardefulla datamangder" — digitally submitted annual reports published as downloadable zip files containing iXBRL documents. The ingestion pipeline (`scripts/ingest.ts`) downloads all available files, parses the XBRL tags, and stores everything in SQLite.

## License

Open data from Bolagsverket. Code is MIT.
