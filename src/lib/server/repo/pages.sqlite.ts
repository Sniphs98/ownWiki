import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { page, pageVersion } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import {
	PageConflictError,
	type CreatePageInput,
	type AddVersionInput,
	type PageSummary
} from './pages.types';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function listPages(): Promise<PageSummary[]> {
	return sqlite
		.select({ id: page.id, path: page.path, title: page.title, updatedAt: page.updatedAt })
		.from(page)
		.orderBy(page.path);
}

export async function getPageWithLatestVersion(path: string) {
	const found = await sqlite.query.page.findFirst({ where: eq(page.path, path) });
	if (!found) return null;

	const version = await sqlite.query.pageVersion.findFirst({
		where: eq(pageVersion.pageId, found.id),
		orderBy: desc(pageVersion.versionNumber)
	});
	if (!version) return null;

	return { page: found, version };
}

export async function listVersions(pageId: string) {
	return sqlite.query.pageVersion.findMany({
		where: eq(pageVersion.pageId, pageId),
		orderBy: desc(pageVersion.versionNumber)
	});
}

// better-sqlite3 transactions are synchronous, hence .get()/.run() below.

export async function createPage(input: CreatePageInput): Promise<string> {
	const pageId = crypto.randomUUID();

	sqlite.transaction((tx) => {
		const existing = tx.select({ id: page.id }).from(page).where(eq(page.path, input.path)).get();
		if (existing) throw new PageConflictError(latestVersionNumber(tx, existing.id));

		tx.insert(page)
			.values({ id: pageId, path: input.path, title: input.title, createdBy: input.authorId })
			.run();
		tx.insert(pageVersion)
			.values({
				id: crypto.randomUUID(),
				pageId,
				versionNumber: 1,
				title: input.title,
				content: input.content,
				changeSummary: input.changeSummary,
				authorId: input.authorId
			})
			.run();
	});

	return pageId;
}

function latestVersionNumber(tx: Pick<typeof sqlite, 'select'>, pageId: string): number {
	const latest = tx
		.select({ versionNumber: pageVersion.versionNumber })
		.from(pageVersion)
		.where(eq(pageVersion.pageId, pageId))
		.orderBy(desc(pageVersion.versionNumber))
		.limit(1)
		.get();
	return latest?.versionNumber ?? 0;
}

export async function addPageVersion(input: AddVersionInput): Promise<number> {
	return sqlite.transaction((tx) => {
		const latest = latestVersionNumber(tx, input.pageId);
		if (input.baseVersion !== undefined && input.baseVersion !== latest) {
			throw new PageConflictError(latest);
		}
		const versionNumber = latest + 1;

		tx.insert(pageVersion)
			.values({
				id: crypto.randomUUID(),
				pageId: input.pageId,
				versionNumber,
				title: input.title,
				content: input.content,
				changeSummary: input.changeSummary,
				authorId: input.authorId
			})
			.run();
		tx.update(page)
			.set({ title: input.title, updatedAt: new Date() })
			.where(eq(page.id, input.pageId))
			.run();

		return versionNumber;
	});
}

// page_version and attachment both reference page.id with onDelete: 'cascade'
// (and the driver has `foreign_keys = ON`, see db/index.ts), so this also
// removes every version and attachment — including their blob data, since
// attachments are stored inline rather than in external object storage.
export async function deletePage(pageId: string): Promise<void> {
	await sqlite.delete(page).where(eq(page.id, pageId));
}
