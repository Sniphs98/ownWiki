import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const dialect = process.env.DATABASE_DIALECT === 'postgresql' ? 'postgresql' : 'sqlite';

export default defineConfig({
	schema:
		dialect === 'postgresql'
			? './src/lib/server/db/schema/pg.ts'
			: './src/lib/server/db/schema/sqlite.ts',
	out: dialect === 'postgresql' ? './drizzle/postgresql' : './drizzle/sqlite',
	dialect,
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
