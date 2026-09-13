import type { CircuitBreakerState, CircuitBreakerConfig } from '@aetherdust/preflight';

export const circuitBreakerConfigs: CircuitBreakerConfig = {
  windowSeconds: 60,
  maxSpendSpeck: 40_000_000_000_000n,
};

const cbStates = new Map<string, CircuitBreakerState>();

export function getCBState(campaignId: string): CircuitBreakerState {
  return cbStates.get(campaignId) ?? {
    windowStart: new Date(),
    spentInWindowSpeck: 0n,
    tripped: false,
  };
}

export function setCBState(campaignId: string, state: CircuitBreakerState): void {
  cbStates.set(campaignId, state);
}
