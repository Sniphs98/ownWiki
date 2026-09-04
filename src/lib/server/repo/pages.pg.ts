import { desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { page, pageVersion } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';
import type { CreatePageInput, AddVersionInput, PageSummary } from './pages.types';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function listPages(): Promise<PageSummary[]> {
	return pg
		.select({ id: page.id, path: page.path, title: page.title, updatedAt: page.updatedAt })
		.from(page)
		.orderBy(page.path);
}

export async function getPageWithLatestVersion(path: string) {
	const found = await pg.query.page.findFirst({ where: eq(page.path, path) });
	if (!found) return null;

	const version = await pg.query.pageVersion.findFirst({
		where: eq(pageVersion.pageId, found.id),
		orderBy: desc(pageVersion.versionNumber)
	});
	if (!version) return null;

	return { page: found, version };
}

export async function listVersions(pageId: string) {
	return pg.query.pageVersion.findMany({
		where: eq(pageVersion.pageId, pageId),
		orderBy: desc(pageVersion.versionNumber)
	});
}

export async function createPage(input: CreatePageInput): Promise<string> {
	const pageId = crypto.randomUUID();

	await pg.insert(page).values({
		id: pageId,
		path: input.path,
		title: input.title,
		createdBy: input.authorId
	});

	await pg.insert(pageVersion).values({
		id: crypto.randomUUID(),
		pageId,
		versionNumber: 1,
		title: input.title,
		content: input.content,
		changeSummary: input.changeSummary,
		authorId: input.authorId
	});

	return pageId;
}

export async function addPageVersion(input: AddVersionInput): Promise<number> {
	const latest = await pg.query.pageVersion.findFirst({
		where: eq(pageVersion.pageId, input.pageId),
		orderBy: desc(pageVersion.versionNumber)
	});
	const versionNumber = (latest?.versionNumber ?? 0) + 1;

	await pg.insert(pageVersion).values({
		id: crypto.randomUUID(),
		pageId: input.pageId,
		versionNumber,
		title: input.title,
		content: input.content,
		changeSummary: input.changeSummary,
		authorId: input.authorId
	});

	await pg
		.update(page)
		.set({ title: input.title, updatedAt: new Date() })
		.where(eq(page.id, input.pageId));

	return versionNumber;
}

// page_version and attachment both reference page.id with onDelete: 'cascade',
// so this also removes every version and attachment — including their
// BLOB/bytea data, since attachments are stored inline rather than in
// external object storage.
export async function deletePage(pageId: string): Promise<void> {
	await pg.delete(page).where(eq(page.id, pageId));
}
