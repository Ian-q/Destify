import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
if (!process.env.DATABASE_URL) loadEnv({ path: '.env' });

async function main() {
  // Import after loading env vars
  const { db } = await import('@/lib/db/client');
  const { loadSeedRows } = await import('@/lib/conditions/seed');

  const result = await loadSeedRows(db);
  console.log(`Seeded ${result.count} condition rows.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
