import { defineConfig } from '@playwright/test';

const PORT = 4173;

/** Further servers from the same build, for the other AUTH_MODEs (auth-modes.e2e.ts). */
export const READ_ONLY_PORT = 4174;
export const FULL_PORT = 4175;
/** A private wiki that logs in with Microsoft (e2e/fake-microsoft.js), registration closed. */
export const MICROSOFT_PORT = 4176;
export const FAKE_MICROSOFT_PORT = 4181;
/** An open wiki with no login at all: PASSWORD_LOGIN=false and no Microsoft. */
export const NO_LOGIN_PORT = 4177;

/** A stand-in for OpenAI's embeddings API (e2e/fake-embeddings.js). */
const EMBEDDINGS_PORT = 4180;

const serverEnv = (port: number, authMode: string, extra: Record<string, string> = {}) => ({
	PORT: String(port),
	ORIGIN: `http://localhost:${port}`,
	DATABASE_DIALECT: 'sqlite',
	// Separate, freshly seeded database — never the developer's wiki.
	DATABASE_URL: `./.data/e2e/${authMode}/wiki.db`,
	AUTH_MODE: authMode,
	ALLOW_SIGNUP: 'true',
	BETTER_AUTH_SECRET: 'e2e-only-secret-0000000000000000000000',
	// As in the Dockerfile: adapter-node's default of 512 KB would refuse
	// most uploads below MAX_ATTACHMENT_SIZE.
	BODY_SIZE_LIMIT: '11M',
	...extra
});

export default defineConfig({
	// Started one after the other: only the first wiki server builds.
	webServer: [
		{
			command: 'node e2e/fake-embeddings.js',
			port: EMBEDDINGS_PORT,
			env: { PORT: String(EMBEDDINGS_PORT) }
		},
		{
			command: 'node e2e/fake-microsoft.js',
			port: FAKE_MICROSOFT_PORT,
			env: { PORT: String(FAKE_MICROSOFT_PORT) }
		},
		{
			// The real production server (adapter-node, as in the Docker image) —
			// not `vite preview` — so the PDF export runs exactly as deployed.
			command: 'node e2e/setup-db.js && npm run build && node build',
			port: PORT,
			timeout: 300_000,
			env: serverEnv(PORT, 'disabled')
		},
		{
			command: 'node e2e/setup-db.js && node build',
			port: READ_ONLY_PORT,
			// An embeddings service that isn't there: the search must still work.
			env: serverEnv(READ_ONLY_PORT, 'read-only', {
				EMBEDDINGS_URL: 'http://localhost:4189/v1',
				EMBEDDINGS_MODEL: 'nicht-erreichbar'
			})
		},
		{
			command: 'node e2e/setup-db.js && node build',
			port: FULL_PORT,
			// With semantic search (semantic-search.e2e.ts).
			env: serverEnv(FULL_PORT, 'full', {
				EMBEDDINGS_URL: `http://localhost:${EMBEDDINGS_PORT}/v1`,
				EMBEDDINGS_MODEL: 'fake'
			})
		},
		{
			command: 'node e2e/setup-db.js && node build',
			port: MICROSOFT_PORT,
			// Its own database, though private like the full server's.
			env: serverEnv(MICROSOFT_PORT, 'full', {
				DATABASE_URL: './.data/e2e/microsoft/wiki.db',
				ALLOW_SIGNUP: 'false',
				MICROSOFT_CLIENT_ID: 'e2e-client',
				MICROSOFT_CLIENT_SECRET: 'e2e-secret',
				MICROSOFT_TENANT_ID: 'e2e-tenant',
				MICROSOFT_AUTHORITY: `http://localhost:${FAKE_MICROSOFT_PORT}`
			})
		},
		{
			command: 'node e2e/setup-db.js && node build',
			port: NO_LOGIN_PORT,
			env: serverEnv(NO_LOGIN_PORT, 'disabled', {
				DATABASE_URL: './.data/e2e/no-login/wiki.db',
				PASSWORD_LOGIN: 'false'
			})
		}
	],
	use: { baseURL: `http://localhost:${PORT}` },
	testMatch: '**/*.e2e.{ts,js}',
	// In CI, a test that fails once may run again: under the full run's load
	// (several servers, PDF rendering) an editor test now and then misses a
	// keystroke, and that shouldn't block a release. Reported as "flaky";
	// a real failure fails twice.
	retries: process.env.CI ? 1 : 0
});
