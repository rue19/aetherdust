# AetherDust Demo DApp

A minimal DApp demonstrating **gasless transactions** on Midnight via AetherDust sponsorship.

## How It Works

1. **User** connects their Midnight wallet (zero DUST required)
2. **User** clicks "Increment" — builds a transaction locally, proves it, balances own value (no DUST)
3. **AetherDust** receives the transaction, validates policy, adds DUST fees, submits to network
4. **Counter increments** on-chain — user never touched DUST

## Setup

### Prerequisites

- Node.js >= 22
- Midnight wallet extension (Lace) installed
- AetherDust API running (see root README)

### Environment Variables

Create `.env.local`:

```
VITE_API_KEY=your_api_key_here
```

### Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

### Build for Production

```bash
npm run build
```

## Architecture

```
User (zero DUST)
  → prepareSponsoredCall() [balances only user value]
  → POST /v1/sponsor [AetherDust API]
  → sponsorAndSubmit() [adds DUST fees]
  → Midnight Network
```

## What This Proves

| Property | Demonstration |
|----------|---------------|
| Gasless transactions | User has zero DUST, sponsor pays fee |
| Privacy preserved | User's proof never reaches sponsor |
| Policy enforcement | Campaign budget, fee limits, rate limits checked |
| Audit trail | Every sponsorship recorded with tx hash |
