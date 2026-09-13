import {
  evaluateCampaignPolicy,
  type Campaign,
  type SponsorRequest,
  type UsageLedger,
} from '@aetherdust/policy-engine';
import type { PolicyResult } from '@aetherdust/policy-engine';

/**
 * IMPORTANT — read before wiring Check 7.
 *
 * The reconnaissance for this PRD found no Midnight API that simulates or
 * dry-runs a transaction independently of proving it. What the architecture
 * gets for free instead: the USER proves the call locally (see
 * packages/sponsor/src/sponsor.ts) before it ever reaches the sponsor. If
 * the circuit's preconditions aren't met, proof generation fails on the
 * user's machine and nothing is sent for sponsorship at all — so a large
 * class of "this would have failed" transactions never reach preflight in
 * the first place.
 *
 * What preflight CAN do, and what it does below, is check everything that
 * does not require touching the ledger: structure, policy, and budget. It
 * cannot promise the transaction will be accepted by the node — only that
 * it passed every check we can perform before spending sponsor DUST. Do not
 * upgrade this to a simulation claim; PRD §10 forbids it explicitly.
 */

export interface RawSponsorPayload {
  transactionHex: string;
  campaignId: string;
  contractAddress?: string;
  entryPoint?: string;
  estimatedFeeSpeck?: bigint;
  usageId?: string;
}

function isStructurallyValid(payload: RawSponsorPayload): boolean {
  if (!payload.transactionHex || !/^[0-9a-fA-F]+$/.test(payload.transactionHex)) return false;
  if (!payload.campaignId) return false;
  if (!payload.contractAddress || !payload.entryPoint) return false;
  if (payload.estimatedFeeSpeck === undefined || payload.estimatedFeeSpeck < 0n) return false;
  if (!payload.usageId) return false;
  return true;
}

export async function runPreflight(
  payload: RawSponsorPayload,
  campaign: Campaign,
  usage: UsageLedger,
  sponsorDustBalanceSpeck: bigint,
): Promise<PolicyResult> {
  // Check 5 — transaction structure
  if (!isStructurallyValid(payload)) {
    return { allowed: false, reason: 'INVALID_TRANSACTION', detail: 'malformed sponsor request' };
  }

  const request: SponsorRequest = {
    campaignId: payload.campaignId,
    contractAddress: payload.contractAddress!,
    entryPoint: payload.entryPoint!,
    estimatedFeeSpeck: payload.estimatedFeeSpeck!,
    usageId: payload.usageId!,
  };

  // Checks 1, 2, 3, 4, 6 — budget, fee ceiling, allowlists, campaign policy
  const policyResult = await evaluateCampaignPolicy(campaign, request, usage);
  if (!policyResult.allowed) return policyResult;

  // Sponsor solvency — not in the PRD's numbered list but required before
  // attempting balanceFinalizedTransaction, or the sponsor-side balance call
  // fails after we've already committed to the request.
  if (sponsorDustBalanceSpeck < request.estimatedFeeSpeck) {
    return { allowed: false, reason: 'SPONSOR_DUST_UNAVAILABLE' };
  }

  return { allowed: true };
}
