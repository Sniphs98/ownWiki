import { dbDialect } from '$lib/server/db';
import { indexPage, removePageFromIndex } from '$lib/server/search';
import { bindTargets, linkTargets } from '$lib/wiki-links';
import { bindUnbound, linksOf, setLinks } from './links';
import type { AddVersionInput, CreatePageInput } from './pages.types';

const impl =
	dbDialect === 'postgresql' ? await import('./pages.pg') : await import('./pages.sqlite');

export const listPages = impl.listPages;
export const getPageWithLatestVersion = impl.getPageWithLatestVersion;
export const getPagePath = impl.getPagePath;
export const listVersions = impl.listVersions;

// Writes keep the search index and the links (backlinks.ts) in step with the pages.

export async function createPage(input: CreatePageInput): Promise<string> {
	const pageId = await impl.createPage(input);
	await updateLinks(pageId, input.content);
	await bindWaitingLinks(pageId, input.path, input.title);
	await indexPage(pageId);
	return pageId;
}

export async function addPageVersion(input: AddVersionInput): Promise<number> {
	const versionNumber = await impl.addPageVersion(input);
	await updateLinks(input.pageId, input.content);
	const path = await impl.getPagePath(input.pageId);
	if (path) await bindWaitingLinks(input.pageId, path, input.title);
	await indexPage(input.pageId);
	return versionNumber;
}

export async function deletePage(pageId: string): Promise<void> {
	await impl.deletePage(pageId);
	await removePageFromIndex(pageId);
}

/**
 * Stores what a page links to, each link bound to the page it means — the
 * same one as before if it still exists, so moves and renames of linked
 * pages don't change where a link leads (see bindTargets).
 */
export async function updateLinks(pageId: string, content: string): Promise<void> {
	const [pages, previous] = await Promise.all([impl.listPages(), linksOf(pageId)]);
	const before = new Map(previous.map((link) => [link.target, link.pageId]));
	await setLinks(pageId, bindTargets(linkTargets(content), before, pages));
}

/** Links written before a page by this path or title existed bind to it now. */
async function bindWaitingLinks(pageId: string, path: string, title: string): Promise<void> {
	const key = path.toLowerCase();
	await bindUnbound([key, `/${key}`, title.toLowerCase()], pageId);
}

export type { PageSummary, CreatePageInput, AddVersionInput } from './pages.types';
export { PageConflictError } from './pages.types';
