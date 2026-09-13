// Deterministic rejection taxonomy (PRD §16). Never reject silently — every
// path that returns { allowed: false } must set one of these.
export type RejectionReason =
  | 'BUDGET_EXCEEDED'
  | 'USER_LIMIT_EXCEEDED'
  | 'TRANSACTION_LIMIT_EXCEEDED'
  | 'CONTRACT_NOT_ALLOWED'
  | 'ENTRYPOINT_NOT_ALLOWED'
  | 'FEE_TOO_HIGH'
  | 'CAMPAIGN_EXPIRED'
  | 'CAMPAIGN_DISABLED'
  | 'CAMPAIGN_NOT_STARTED'
  | 'INVALID_TRANSACTION'
  | 'PREFLIGHT_FAILED'
  | 'SPONSOR_DUST_UNAVAILABLE'
  | 'NULLIFIER_ALREADY_USED';

export type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: RejectionReason; detail?: string };
