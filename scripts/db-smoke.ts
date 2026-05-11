import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
if (!process.env.DATABASE_URL) loadEnv({ path: '.env' });

async function main() {
  // Import after loading env vars
  const { db } = await import('@/lib/db/client');
  const { users } = await import('@/lib/db/schema');

  const rows = await db.select().from(users).limit(1);
  console.log('users table reachable, rows:', rows.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
