# Deploying bokprism.se

Production deployment on a Linux server with Docker behind a shared Caddy reverse proxy.

## Prerequisites

- Docker and Docker Compose installed
- Shared Caddy proxy running (see [caddy-infra](https://github.com/ClaudeCarlsson/caddy-infra))
- DNS A records for `bokprism.se` and `www.bokprism.se` pointing to the server

## Deploy

```bash
# 1. Clone the repo
git clone <repo-url> bokprism
cd bokprism

# 2. Transfer the database (13 GB, not in git)
mkdir -p data
scp dev-machine:~/repos/bokprism/data/bokprism.db data/bokprism.db

# 3. Start (requires the shared 'web' network from caddy-infra)
cd infra
docker compose up -d
```

## Verify

```bash
docker compose ps
docker compose logs bokprism-app
curl -I https://bokprism.se
```

## Update the database

```bash
# Compressed transfer (~3-4 GB over wire)
ssh dev-machine "zstd -c ~/repos/bokprism/data/bokprism.db" | zstd -d > data/bokprism.db

# Restart to pick up the new file
cd infra
docker compose restart bokprism-app
```

## Update the application

```bash
git pull
cd infra
docker compose up -d --build
```

## Architecture

```
Internet → :443 → Caddy (shared) → bokprism-app:3000
                                      │
                                      └── SQLite (read-only bind mount, 13 GB)
```

TLS, compression, and security headers are handled by the shared Caddy instance in [caddy-infra](https://github.com/ClaudeCarlsson/caddy-infra). This repo only runs the application container on the shared `web` Docker network.
