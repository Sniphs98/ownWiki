import { dbDialect } from '$lib/server/db';
import { indexPage, removePageFromIndex } from '$lib/server/search';
import type { AddVersionInput, CreatePageInput } from './pages.types';

const impl =
	dbDialect === 'postgresql' ? await import('./pages.pg') : await import('./pages.sqlite');

export const listPages = impl.listPages;
export const getPageWithLatestVersion = impl.getPageWithLatestVersion;
export const listVersions = impl.listVersions;

// Writes keep the search index in step with the pages.

export async function createPage(input: CreatePageInput): Promise<string> {
	const pageId = await impl.createPage(input);
	await indexPage(pageId);
	return pageId;
}

export async function addPageVersion(input: AddVersionInput): Promise<number> {
	const versionNumber = await impl.addPageVersion(input);
	await indexPage(input.pageId);
	return versionNumber;
}

export async function deletePage(pageId: string): Promise<void> {
	await impl.deletePage(pageId);
	await removePageFromIndex(pageId);
}

export type { PageSummary, CreatePageInput, AddVersionInput } from './pages.types';
