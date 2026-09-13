import { getDb, closePool } from './client.js';
import { projects, campaigns, adminUsers } from './schema/index.js';
import { createAdminUser } from './repositories/admin-user.js';
import { createProject } from './repositories/project.js';
import { createCampaign } from './repositories/campaign.js';
import { createApiKey } from './repositories/api-key.js';

async function seed() {
  console.log('Seeding database...');

  const admin = await createAdminUser({
    email: 'admin@aetherdust.local',
    password: 'changeme',
    name: 'Admin',
    role: 'admin',
  });
  console.log(`Created admin user: ${admin.email} (id: ${admin.id})`);

  const project = await createProject({ name: 'Demo Project', ownerId: admin.id });
  console.log(`Created project: ${project.name} (id: ${project.id})`);

  const campaign = await createCampaign({
    projectId: project.id,
    name: 'Demo Campaign',
    dailyBudgetSpeck: 50_000_000_000_000n,
    perTxLimitSpeck: 1_000_000_000_000n,
    perUserTxLimit: 10,
    epochDurationSeconds: 86400,
    allowedContracts: ['0x1234'],
    allowedEntryPoints: ['checkin'],
    startTime: new Date('2020-01-01'),
  });
  console.log(`Created campaign: ${campaign.name} (id: ${campaign.id})`);

  const apiKey = await createApiKey({
    projectId: project.id,
    name: 'Demo API Key',
    scopes: ['sponsor', 'campaigns:read'],
  });
  console.log(`Created API key: ${apiKey.keyPrefix}... (full: ${apiKey.plaintextKey})`);

  console.log('Seed complete.');
  await closePool();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
