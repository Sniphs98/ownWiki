import { defineConfig } from '@playwright/test';

const PORT = 4173;

/** Further servers from the same build, for the other AUTH_MODEs (auth-modes.e2e.ts). */
export const READ_ONLY_PORT = 4174;
export const FULL_PORT = 4175;

/** Lets e2e/mcp.e2e.ts in through the MCP endpoint. */
export const MCP_TOKEN = 'e2e-mcp-token';

const serverEnv = (port: number, authMode: string) => ({
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
	MCP_TOKEN
});

export default defineConfig({
	// Started one after the other: only the first one builds.
	webServer: [
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
			env: serverEnv(READ_ONLY_PORT, 'read-only')
		},
		{
			command: 'node e2e/setup-db.js && node build',
			port: FULL_PORT,
			env: serverEnv(FULL_PORT, 'full')
		}
	],
	use: { baseURL: `http://localhost:${PORT}` },
	testMatch: '**/*.e2e.{ts,js}'
});
