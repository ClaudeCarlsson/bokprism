# Deploying bokprism.se

Production deployment on a Linux server with Docker.

## Prerequisites

- Docker and Docker Compose installed
- Ports 80 and 443 open in the firewall
- DNS A records for `bokprism.se` and `www.bokprism.se` pointing to the server's public IP

## Deploy

```bash
# 1. Clone the repo
git clone <repo-url> bokprism
cd bokprism

# 2. Transfer the database from dev machine (13 GB, not in git)
mkdir -p data
scp dev-machine:~/repos/bokprism/data/bokprism.db data/bokprism.db

# 3. Start
cd infra
docker compose up -d
```

Caddy automatically obtains TLS certificates from Let's Encrypt on first start.

## Verify

```bash
docker compose ps
docker compose logs app
docker compose logs caddy
curl -I http://localhost
```

The site should be live at https://bokprism.se within a minute.

## Update the database

The database is 13 GB and too large for git. Transfer it over the network:

```bash
# From dev machine, compress and send (cuts transfer to ~3-4 GB)
ssh dev-machine "zstd -c ~/repos/bokprism/data/bokprism.db" | zstd -d > data/bokprism.db

# Or with plain scp
scp dev-machine:~/repos/bokprism/data/bokprism.db data/bokprism.db

# Restart to pick up the new file
cd infra
docker compose restart app
```

## Update the application

```bash
git pull
cd infra
docker compose up -d --build
```

## Automated deploys

Add to crontab on the production server:

```bash
crontab -e
# Check for updates every 5 minutes
*/5 * * * * /home/deploy/bokprism/deploy.sh
```

This only rebuilds when there are new commits on main.

## Architecture

```
Internet
  |
  +- :80  --> Caddy (redirect to HTTPS)
  +- :443 --> Caddy (TLS termination) --> app:3000
                                            |
                                            +-- SQLite (read-only bind mount, 13 GB)
```

- `bokprism` Docker network isolates containers
- Only ports 80/443 exposed to host; app not directly reachable
- Database mounted read-only; application makes no writes

## Running alongside skolsalsa

If both sites share a server, use separate Docker networks and a shared Caddy instance,
or run each with its own Caddy on different ports. The simplest approach: each project
gets its own Caddy and ports. Ensure DNS points each domain to the correct server.

## Configuration

| Setting | File | Default |
|---------|------|---------|
| ACME email | `Caddyfile` | `admin@bokprism.se` |
| Domain names | `Caddyfile` | `bokprism.se`, `www.bokprism.se` |
| Request body limit | `Caddyfile` | 1 MB |
| Database path | `docker-compose.yml` | `../data/bokprism.db` mounted at `/app/data/bokprism.db` |
