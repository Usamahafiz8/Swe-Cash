import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Config (override via env vars) ──────────────────────────────────────────
const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@swecash.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     ?? 'Super Admin';

// ─── Countries ────────────────────────────────────────────────────────────────
const TIER1_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
];

const RESTRICTED_COUNTRIES = [
  { code: 'KP', name: 'North Korea' },
  { code: 'IR', name: 'Iran' },
  { code: 'CU', name: 'Cuba' },
  { code: 'SY', name: 'Syria' },
];

async function main() {
  console.log('🌱 Starting seed...\n');

  // ─── Super Admin ─────────────────────────────────────────────────────────
  const existing = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.admin.create({
      data: {
        email:        ADMIN_EMAIL,
        passwordHash,
        name:         ADMIN_NAME,
        role:         AdminRole.super_admin,
      },
    });
    console.log(`✓ Admin created`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  ⚠  Change the password immediately after first login!\n`);
  } else {
    console.log(`✓ Admin already exists (${ADMIN_EMAIL}) — skipped\n`);
  }

  // ─── Tier 1 countries (payout-enabled) ───────────────────────────────────
  let countriesCreated = 0;
  for (const c of TIER1_COUNTRIES) {
    await prisma.country.upsert({
      where:  { code: c.code },
      update: {},
      create: { code: c.code, name: c.name, isEnabled: true, payoutEnabled: true, isRestricted: false },
    });
    countriesCreated++;
  }

  // ─── Restricted countries (blocked registration) ─────────────────────────
  for (const c of RESTRICTED_COUNTRIES) {
    await prisma.country.upsert({
      where:  { code: c.code },
      update: {},
      create: { code: c.code, name: c.name, isEnabled: false, payoutEnabled: false, isRestricted: true },
    });
    countriesCreated++;
  }

  console.log(`✓ ${countriesCreated} countries seeded`);
  console.log(`  Tier 1 (payout-enabled): ${TIER1_COUNTRIES.length}`);
  console.log(`  Restricted (blocked):    ${RESTRICTED_COUNTRIES.length}\n`);

  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
