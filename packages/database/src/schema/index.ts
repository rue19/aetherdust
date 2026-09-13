import { pgTable, uuid, text, boolean, integer, numeric, timestamp, inet, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const txStatusEnum = pgEnum('tx_status', ['pending', 'sponsored', 'rejected', 'failed']);
export const actorTypeEnum = pgEnum('actor_type', ['admin', 'api_key', 'system']);
export const adminRoleEnum = pgEnum('admin_role', ['admin', 'viewer']);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  dailyBudgetSpeck: numeric('daily_budget_speck', { precision: 39, scale: 0 }).notNull(),
  perTxLimitSpeck: numeric('per_tx_limit_speck', { precision: 39, scale: 0 }).notNull(),
  perUserTxLimit: integer('per_user_tx_limit').notNull(),
  epochDurationSeconds: integer('epoch_duration_seconds').notNull(),
  allowedContracts: text('allowed_contracts').array().notNull().default([]),
  allowedEntryPoints: text('allowed_entry_points').array().notNull().default([]),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  cbWindowSeconds: integer('cb_window_seconds').notNull().default(60),
  cbMaxSpeck: numeric('cb_max_speck', { precision: 39, scale: 0 }).notNull().default('40000000000000'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  status: txStatusEnum('status').notNull(),
  rejectionReason: text('rejection_reason'),
  txHash: text('tx_hash'),
  transactionHex: text('transaction_hex').notNull(),
  dustFeeSpeck: numeric('dust_fee_speck', { precision: 39, scale: 0 }).notNull().default('0'),
  contractAddress: text('contract_address'),
  entryPoint: text('entry_point'),
  usageId: text('usage_id').notNull(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const usageLedger = pgTable('usage_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  usageId: text('usage_id').notNull(),
  feeSpeck: numeric('fee_speck', { precision: 39, scale: 0 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  name: text('name').notNull(),
  scopes: text('scopes').array().notNull().default(['sponsor']),
  rateLimitRps: integer('rate_limit_rps').notNull().default(10),
  enabled: boolean('enabled').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: adminRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  actorType: actorTypeEnum('actor_type').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
