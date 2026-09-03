// Applies pending Drizzle migrations on container boot. Standalone (no
// SvelteKit env), so it works against the pruned production node_modules.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dialect = process.env.DATABASE_DIALECT === 'postgresql' ? 'postgresql' : 'sqlite';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is not set');

if (dialect === 'postgresql') {
	const { drizzle } = await import('drizzle-orm/postgres-js');
	const { migrate } = await import('drizzle-orm/postgres-js/migrator');
	const { default: postgres } = await import('postgres');
	const client = postgres(databaseUrl, { max: 1 });
	await migrate(drizzle(client), { migrationsFolder: 'drizzle/postgresql' });
	await client.end();
} else {
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const { default: Database } = await import('better-sqlite3');
	const path = resolve(databaseUrl);
	mkdirSync(dirname(path), { recursive: true });
	const client = new Database(path);
	client.pragma('journal_mode = WAL');
	migrate(drizzle(client), { migrationsFolder: 'drizzle/sqlite' });
	client.close();
}

console.log(`[migrate] applied pending ${dialect} migrations`);
