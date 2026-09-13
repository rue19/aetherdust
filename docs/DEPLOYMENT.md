# Deployment Guide

## Prerequisites
- Node.js 22+
- PostgreSQL 16+ (or use Docker)
- Docker & Docker Compose (for containerized deployment)

## Quick Start (Docker)

```bash
git clone <repo-url> aetherdust
cd aetherdust

# Copy and configure environment
cp .env.example .env
# Edit .env with your secrets

# Start all services
docker compose up -d

# The API is available at http://localhost:3000
# The dashboard is available at http://localhost:5173
```

## Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL (via Docker)
docker compose up postgres -d

# Run database migrations
npm run db:migrate -w @aetherdust/database

# Seed demo data
npm run db:seed -w @aetherdust/database

# Build all packages
npm run build

# Start the API in dev mode
npm run dev -w @aetherdust/api

# In another terminal, start the dashboard
npm run dev -w @aetherdust/dashboard
```

## Production

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | API listen port |
| `HOST` | No | `0.0.0.0` | API listen host |
| `NODE_ENV` | No | `development` | Set to `production` |
| `LOG_LEVEL` | No | `info` | pino log level |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Secret for admin JWT signing |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `RATE_LIMIT_RPS` | No | `10` | Max requests per second per API key |
| `RATE_LIMIT_WINDOW_MS` | No | `1000` | Rate limit window in ms |

### Build & Run

```bash
npm install
npm run build

# Run migrations
DATABASE_URL=postgresql://... npm run db:migrate -w @aetherdust/database

# Start
node packages/api/dist/main.js
```

### Database Setup

```bash
# Generate migration
npm run db:generate -w @aetherdust/database

# Apply migration
npm run db:migrate -w @aetherdust/database

# Or push schema directly (dev only)
npm run db:push -w @aetherdust/database
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│    Dashboard     │────▶│     API      │────▶│  PostgreSQL  │
│  (React/Vite)   │     │  (Fastify)   │     │              │
└─────────────────┘     └──────┬───────┘     └──────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼───┐ ┌───▼────┐ ┌───▼──────┐
              │ Policy   │ │Pre-   │ │ Sponsor  │
              │ Engine   │ │flight │ │ (wallet) │
              └─────────┘ └───────┘ └──────────┘
```
