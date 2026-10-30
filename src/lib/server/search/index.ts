import { dbDialect } from '$lib/server/db';
import { queueSemanticIndex, semanticSearch } from './semantic';
import { fuseRankings } from './semantic/vectors';
import type { SearchHit, SearchProvider } from './types';

/**
 * The wiki's search. Pages are (re)indexed by the page repository
 * whenever they're saved or deleted (repo/pages.ts).
 */
const provider: SearchProvider =
	dbDialect === 'postgresql'
		? (await import('./search.pg')).pgSearch
		: (await import('./search.sqlite')).sqliteSearch;

/**
 * Full-text hits and — with an embeddings service configured — pages
 * close in meaning (semantic/), merged by rank. A page found both ways
 * keeps its full-text snippet, with the matched words marked.
 */
export async function searchPages(query: string, limit = 50): Promise<SearchHit[]> {
	const [byWords, byMeaning] = await Promise.all([
		provider.search(query, limit),
		semanticSearch(query, limit)
	]);
	return fuseRankings([byWords, byMeaning]).slice(0, limit);
}

export async function indexPage(pageId: string) {
	await provider.indexPage(pageId);
	queueSemanticIndex(pageId);
}

export async function removePageFromIndex(pageId: string) {
	await provider.removePage(pageId);
	queueSemanticIndex(pageId);
}

export { semanticSearchEnabled, startSemanticIndex } from './semantic';
export type { SearchHit, SnippetPart } from './types';
