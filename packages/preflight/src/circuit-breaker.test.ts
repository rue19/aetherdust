import { describe, it, expect, vi } from 'vitest';
import { recordSpendAndCheck, type CircuitBreakerConfig, type CircuitBreakerState } from './circuit-breaker.js';

const config: CircuitBreakerConfig = { windowSeconds: 60, maxSpendSpeck: 1000n };

function freshState(): CircuitBreakerState {
  return { windowStart: new Date('2025-01-01T00:00:00Z'), spentInWindowSpeck: 0n, tripped: false };
}

describe('recordSpendAndCheck', () => {
  it('records spend within window', () => {
    const state = recordSpendAndCheck(freshState(), 500n, config, new Date('2025-01-01T00:00:30Z'));
    expect(state.spentInWindowSpeck).toBe(500n);
    expect(state.tripped).toBe(false);
  });

  it('trips when spend exceeds max', () => {
    const state = recordSpendAndCheck(freshState(), 1001n, config);
    expect(state.tripped).toBe(true);
  });

  it('rolls over window', () => {
    const initial = freshState();
    initial.spentInWindowSpeck = 999n;
    const state = recordSpendAndCheck(initial, 0n, config, new Date('2025-01-01T00:01:01Z'));
    expect(state.spentInWindowSpeck).toBe(0n);
    expect(state.tripped).toBe(false);
  });

  it('does not roll over within window', () => {
    const initial = freshState();
    initial.spentInWindowSpeck = 999n;
    const state = recordSpendAndCheck(initial, 0n, config, new Date('2025-01-01T00:00:59Z'));
    expect(state.spentInWindowSpeck).toBe(999n);
  });

  it('handles zero spend', () => {
    const state = recordSpendAndCheck(freshState(), 0n, config);
    expect(state.spentInWindowSpeck).toBe(0n);
    expect(state.tripped).toBe(false);
  });

  it('accumulates spend across calls', () => {
    let state = recordSpendAndCheck(freshState(), 400n, config);
    state = recordSpendAndCheck(state, 400n, config);
    expect(state.spentInWindowSpeck).toBe(800n);
    expect(state.tripped).toBe(false);
  });

  it('trips at exact boundary', () => {
    const state = recordSpendAndCheck(freshState(), 1000n, config);
    expect(state.tripped).toBe(false);
  });
});
