// PRD §24. Pauses a campaign automatically when DUST consumption spikes
// past a configured threshold within a rolling window. This is intentionally
// simple for the MVP: a sliding counter, not a statistical anomaly detector.

export interface CircuitBreakerConfig {
  windowSeconds: number;
  maxSpendSpeck: bigint;
}

export interface CircuitBreakerState {
  windowStart: Date;
  spentInWindowSpeck: bigint;
  tripped: boolean;
}

export function recordSpendAndCheck(
  state: CircuitBreakerState,
  spendSpeck: bigint,
  config: CircuitBreakerConfig,
  now: Date = new Date(),
): CircuitBreakerState {
  const windowAgeSeconds = (now.getTime() - state.windowStart.getTime()) / 1000;
  const rolledOver = windowAgeSeconds > config.windowSeconds;

  const windowStart = rolledOver ? now : state.windowStart;
  const spentInWindowSpeck = (rolledOver ? 0n : state.spentInWindowSpeck) + spendSpeck;
  const tripped = spentInWindowSpeck > config.maxSpendSpeck;

  return { windowStart, spentInWindowSpeck, tripped };
}
