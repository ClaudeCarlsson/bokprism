#!/usr/bin/env bash
# Transfer the cleaned DB from dev to prod and restart the container.
# Run this on the dev machine after the re-ingestion completes.
set -euo pipefail

DEV_DB="$HOME/repos/bokprism/data/bokprism.db"
PROD_HOST="claude@192.168.117.235"
PROD_PATH="~/bokprism/data/bokprism.db"

if [ ! -f "$DEV_DB" ]; then
  echo "ERROR: $DEV_DB not found"
  exit 1
fi

# Verify DB integrity before transfer
echo "Verifying local DB integrity..."
SIZE=$(stat -c%s "$DEV_DB")
SIZE_GB=$((SIZE / 1073741824))
echo "  Size: ${SIZE_GB}GB"

if [ "$SIZE" -lt 1000000000 ]; then
  echo "ERROR: DB too small (${SIZE} bytes). Re-ingestion likely incomplete."
  exit 1
fi

# Quick sanity check via sqlite3 or node
node -e "
const Database = require('better-sqlite3');
const db = new Database('$DEV_DB', { readonly: true });
const rows = db.prepare('SELECT COUNT(*) as c FROM financial_data').get();
const cos = db.prepare('SELECT COUNT(*) as c FROM companies').get();
const filings = db.prepare('SELECT COUNT(*) as c FROM filings').get();
console.log('  companies:', cos.c.toLocaleString());
console.log('  filings:', filings.c.toLocaleString());
console.log('  data points:', rows.c.toLocaleString());
if (cos.c < 100000 || rows.c < 10000000) {
  console.error('ERROR: row counts too low, ingestion incomplete');
  process.exit(1);
}
db.close();
"

echo ""
echo "Transferring to prod..."
# Use rsync with progress for large file
scp "$DEV_DB" "$PROD_HOST:$PROD_PATH"

echo ""
echo "Restarting prod container..."
ssh "$PROD_HOST" "cd ~/bokprism/infra && docker compose restart bokprism-app"

echo ""
echo "Done. Verify at https://bokprism.se"
