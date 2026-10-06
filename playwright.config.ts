import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	webServer: {
		// The real production server (adapter-node, as in the Docker image) —
		// not `vite preview` — so the PDF export runs exactly as deployed.
		command: 'node e2e/setup-db.js && npm run build && node build',
		port: PORT,
		timeout: 300_000,
		env: {
			PORT: String(PORT),
			ORIGIN: `http://localhost:${PORT}`,
			DATABASE_DIALECT: 'sqlite',
			// Separate, freshly seeded database — never the developer's wiki.
			DATABASE_URL: './.data/e2e/wiki.db',
			AUTH_MODE: 'disabled',
			BETTER_AUTH_SECRET: 'e2e-only-secret-0000000000000000000000'
		}
	},
	use: { baseURL: `http://localhost:${PORT}` },
	testMatch: '**/*.e2e.{ts,js}'
});
