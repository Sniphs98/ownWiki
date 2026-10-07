import { desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { page, pageVersion } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';
import {
	PageConflictError,
	type CreatePageInput,
	type AddVersionInput,
	type PageSummary
} from './pages.types';

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

type Tx = Parameters<Parameters<typeof pg.transaction>[0]>[0];

async function latestVersionNumber(tx: Tx, pageId: string): Promise<number> {
	const [latest] = await tx
		.select({ versionNumber: pageVersion.versionNumber })
		.from(pageVersion)
		.where(eq(pageVersion.pageId, pageId))
		.orderBy(desc(pageVersion.versionNumber))
		.limit(1);
	return latest?.versionNumber ?? 0;
}

export async function createPage(input: CreatePageInput): Promise<string> {
	const pageId = crypto.randomUUID();

	try {
		await pg.transaction(async (tx) => {
			await tx.insert(page).values({
				id: pageId,
				path: input.path,
				title: input.title,
				createdBy: input.authorId
			});
			await tx.insert(pageVersion).values({
				id: crypto.randomUUID(),
				pageId,
				versionNumber: 1,
				title: input.title,
				content: input.content,
				changeSummary: input.changeSummary,
				authorId: input.authorId
			});
		});
	} catch (err) {
		// unique_violation on page.path: created by someone else meanwhile.
		// Drizzle wraps the driver's error, keeping it as `cause`.
		const { code, cause } = err as { code?: string; cause?: { code?: string } };
		if ((cause?.code ?? code) !== '23505') throw err;
		const existing = await getPageWithLatestVersion(input.path);
		throw new PageConflictError(existing?.version.versionNumber ?? 0);
	}

	return pageId;
}

export async function addPageVersion(input: AddVersionInput): Promise<number> {
	return pg.transaction(async (tx) => {
		// Locks the page row, so concurrent saves of one page take turns.
		await tx.select({ id: page.id }).from(page).where(eq(page.id, input.pageId)).for('update');

		const latest = await latestVersionNumber(tx, input.pageId);
		if (input.baseVersion !== undefined && input.baseVersion !== latest) {
			throw new PageConflictError(latest);
		}
		const versionNumber = latest + 1;

		await tx.insert(pageVersion).values({
			id: crypto.randomUUID(),
			pageId: input.pageId,
			versionNumber,
			title: input.title,
			content: input.content,
			changeSummary: input.changeSummary,
			authorId: input.authorId
		});
		await tx
			.update(page)
			.set({ title: input.title, updatedAt: new Date() })
			.where(eq(page.id, input.pageId));

		return versionNumber;
	});
}

// page_version and attachment both reference page.id with onDelete: 'cascade',
// so this also removes every version and attachment — including their
// BLOB/bytea data, since attachments are stored inline rather than in
// external object storage.
export async function deletePage(pageId: string): Promise<void> {
	await pg.delete(page).where(eq(page.id, pageId));
}
