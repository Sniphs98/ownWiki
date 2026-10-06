// Recreates the e2e database from scratch (migrations + fixture pages), so
// every Playwright run starts from the same known content. Run by the
// webServer command in playwright.config.ts, which also sets DATABASE_URL.
import { readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

rmSync(dirname(resolve(databaseUrl)), { recursive: true, force: true });
await import('../scripts/migrate.js');

const fixtures = [
	{
		path: 'e2e/pdf-export',
		title: 'PDF-Export Prüfseite',
		content: readFileSync(new URL('./fixtures/pdf-export.md', import.meta.url), 'utf8')
	},
	{
		path: 'e2e/long-text',
		title: 'Fließtext Prüfseite',
		content: readFileSync(new URL('./fixtures/long-text.md', import.meta.url), 'utf8')
	},
	{
		path: 'e2e/long-code',
		title: 'Code Prüfseite',
		content: readFileSync(new URL('./fixtures/long-code.md', import.meta.url), 'utf8')
	},
	{
		path: 'e2e/diagrams',
		title: 'Diagramme Prüfseite',
		content: readFileSync(new URL('./fixtures/diagrams.md', import.meta.url), 'utf8')
	},
	{
		path: 'e2e/diagram-break',
		title: 'Diagramm am Seitenanfang',
		content: readFileSync(new URL('./fixtures/diagram-break.md', import.meta.url), 'utf8')
	},
	{
		path: 'e2e/files',
		title: 'Dateien Prüfseite',
		content: readFileSync(new URL('./fixtures/files.md', import.meta.url), 'utf8')
	}
];

const db = new Database(resolve(databaseUrl));
const insertPage = db.prepare('INSERT INTO page (id, path, title) VALUES (?, ?, ?)');
const insertVersion = db.prepare(
	'INSERT INTO page_version (id, page_id, version_number, title, content) VALUES (?, ?, 1, ?, ?)'
);
for (const { path, title, content } of fixtures) {
	const pageId = randomUUID();
	insertPage.run(pageId, path, title);
	insertVersion.run(randomUUID(), pageId, title, content);
}
db.close();

console.log(`[e2e] seeded ${fixtures.length} fixture page(s)`);
