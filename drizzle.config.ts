import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: '.env.local' });
if (!process.env.DATABASE_URL) loadEnv({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set — run `vercel env pull .env.local` first.');
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
