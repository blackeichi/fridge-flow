import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/user/schema.ts',
  out: './src/db/user/migrations',
  strict: true,
  verbose: true,
});
