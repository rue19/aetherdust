# Contributing

## Setup

```bash
npm install
npm run build
```

## Development

```bash
# Start API in watch mode
npm run dev -w @aetherdust/api

# Start dashboard in dev mode
npm run dev -w @aetherdust/dashboard

# Run all tests
npx vitest run

# Run tests in watch mode
npx vitest
```

## Project Structure

```
packages/
  policy-engine/    # Pure policy evaluation (no I/O)
  preflight/        # Pre-submission validation
  sponsor/          # Transaction submission
  midnight/         # Midnight SDK wrapper
  database/         # Drizzle ORM + PostgreSQL
  api/              # Fastify REST API
  dashboard/        # React SPA
```

## Conventions

- TypeScript strict mode, ESM modules
- Fastify for HTTP, Drizzle for ORM, Vitest for tests
- All rejection reasons are typed (see `packages/policy-engine/src/rejection-reasons.ts`)
- No comments in code unless explicitly requested
- Commit messages: `<type>(<scope>): <description>`

## Testing

```bash
# Full test suite
npx vitest run

# Specific package
npx vitest run packages/policy-engine

# With coverage
npx vitest run --coverage
```
