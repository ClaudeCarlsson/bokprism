# Multi-stage Dockerfile for BokPrism

# ============================================
# Stage 1: Base with Node.js and build tools
# ============================================
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# Stage 3: Build the Next.js app
# ============================================
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Need a stub DB for the build to succeed (static pages reference queries)
RUN mkdir -p data && node -e " \
  const Database = require('better-sqlite3'); \
  const db = new Database('data/bokprism.db'); \
  db.exec('CREATE TABLE companies (org_number TEXT PRIMARY KEY, name TEXT)'); \
  db.exec('CREATE TABLE filings (id INTEGER PRIMARY KEY, org_number TEXT, period_start TEXT, period_end TEXT, currency TEXT, source_file TEXT)'); \
  db.exec('CREATE TABLE financial_data (filing_id INTEGER, metric TEXT, value REAL, unit TEXT, PRIMARY KEY(filing_id, metric))'); \
  db.exec('CREATE TABLE people (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT)'); \
  db.exec('CREATE TABLE company_roles (filing_id INTEGER, person_id INTEGER, role TEXT, PRIMARY KEY(filing_id, person_id, role))'); \
  db.exec('CREATE TABLE filing_texts (filing_id INTEGER, field TEXT, content TEXT, PRIMARY KEY(filing_id, field))'); \
  db.exec('CREATE TABLE processed_files (file_key TEXT PRIMARY KEY, processed_at TEXT, company_count INTEGER)'); \
  db.exec(\"CREATE VIRTUAL TABLE companies_fts USING fts5(name, org_number, content='companies', content_rowid='rowid')\"); \
  db.close();"
RUN npm run build

# ============================================
# Stage 4: Production image (minimal)
# ============================================
FROM node:22-bookworm-slim AS production
WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=build --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=build --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=build --chown=appuser:appgroup /app/public ./public

USER appuser
VOLUME ["/app/data"]
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
