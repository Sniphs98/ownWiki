import { dbDialect } from '$lib/server/db';
import type { SearchProvider } from './types';

/**
 * The wiki's search. Pages are (re)indexed by the page repository
 * whenever they're saved or deleted (repo/pages.ts).
 */
const provider: SearchProvider =
	dbDialect === 'postgresql'
		? (await import('./search.pg')).pgSearch
		: (await import('./search.sqlite')).sqliteSearch;

export const searchPages = (query: string, limit = 50) => provider.search(query, limit);
export const indexPage = (pageId: string) => provider.indexPage(pageId);
export const removePageFromIndex = (pageId: string) => provider.removePage(pageId);

export type { SearchHit, SnippetPart } from './types';
