import type { PolicyResult } from './rejection-reasons.js';

export interface Campaign {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  dailyBudgetSpeck: bigint; // DUST budget for the campaign, in SPECK (1 DUST = 10^15 SPECK)
  perTransactionLimitSpeck: bigint;
  perUserTransactionLimit: number;
  epochDurationSeconds: number;
  allowedContracts: string[]; // contract addresses, exact match
  allowedEntryPoints: string[]; // circuit / entry-point names, exact match
  startTime: Date;
  endTime: Date | null;
}

export interface SponsorRequest {
  campaignId: string;
  contractAddress: string;
  entryPoint: string;
  estimatedFeeSpeck: bigint;
  /** Nullifier or other privacy-preserving usage identifier — see packages/privacy */
  usageId: string;
}

export interface UsageLedger {
  /** DUST already spent by this campaign today, in SPECK. */
  spentTodaySpeck(campaignId: string): Promise<bigint>;
  /** Sponsored-transaction count for this usage identifier in the current epoch. */
  usageCountThisEpoch(campaignId: string, usageId: string): Promise<number>;
}

/**
 * Pure policy evaluation (PRD §7-8). Every branch returns a tagged
 * RejectionReason so the API layer and dashboard can render a deterministic
 * cause. This function does not touch the network or the wallet — it only
 * reads the campaign config and the usage ledger.
 */
export async function evaluateCampaignPolicy(
  campaign: Campaign,
  request: SponsorRequest,
  usage: UsageLedger,
  now: Date = new Date(),
): Promise<PolicyResult> {
  if (!campaign.enabled) {
    return { allowed: false, reason: 'CAMPAIGN_DISABLED' };
  }
  if (now < campaign.startTime) {
    return { allowed: false, reason: 'CAMPAIGN_NOT_STARTED' };
  }
  if (campaign.endTime && now > campaign.endTime) {
    return { allowed: false, reason: 'CAMPAIGN_EXPIRED' };
  }
  if (!campaign.allowedContracts.includes(request.contractAddress)) {
    return { allowed: false, reason: 'CONTRACT_NOT_ALLOWED' };
  }
  if (!campaign.allowedEntryPoints.includes(request.entryPoint)) {
    return { allowed: false, reason: 'ENTRYPOINT_NOT_ALLOWED' };
  }
  if (request.estimatedFeeSpeck > campaign.perTransactionLimitSpeck) {
    return { allowed: false, reason: 'FEE_TOO_HIGH' };
  }

  const spentToday = await usage.spentTodaySpeck(campaign.id);
  if (spentToday + request.estimatedFeeSpeck > campaign.dailyBudgetSpeck) {
    return { allowed: false, reason: 'BUDGET_EXCEEDED' };
  }

  const userCount = await usage.usageCountThisEpoch(campaign.id, request.usageId);
  if (userCount >= campaign.perUserTransactionLimit) {
    return { allowed: false, reason: 'USER_LIMIT_EXCEEDED' };
  }

  return { allowed: true };
}
