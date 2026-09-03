import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

/**
 * Which database backend to use. Defaults to `sqlite` since that requires
 * no extra infrastructure for simple self-hosted setups; set
 * DATABASE_DIALECT=postgresql for larger deployments.
 */
export const dbDialect = env.DATABASE_DIALECT === 'postgresql' ? 'postgresql' : 'sqlite';

async function createDb() {
	if (dbDialect === 'postgresql') {
		const { drizzle } = await import('drizzle-orm/postgres-js');
		const { default: postgres } = await import('postgres');
		const schema = await import('./schema/pg');
		const client = postgres(env.DATABASE_URL as string);
		return drizzle(client, { schema });
	}

	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { default: Database } = await import('better-sqlite3');
	const schema = await import('./schema/sqlite');
	const path = resolve(env.DATABASE_URL as string);
	mkdirSync(dirname(path), { recursive: true });
	const client = new Database(path);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	return drizzle(client, { schema });
}

export const db = await createDb();
