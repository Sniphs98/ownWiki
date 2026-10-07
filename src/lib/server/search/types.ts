/** A piece of a result snippet; `match` marks the words that matched. */
export interface SnippetPart {
	text: string;
	match: boolean;
}

export interface SearchHit {
	pageId: string;
	path: string;
	title: string;
	snippet: SnippetPart[];
}

/**
 * A way of finding pages. Today there's one — full-text search in the
 * database (search.sqlite.ts / search.pg.ts). A semantic search over
 * vector embeddings can implement the same interface later and be merged
 * into the results in search/index.ts, without touching pages or the UI.
 */
export interface SearchProvider {
	search(query: string, limit: number): Promise<SearchHit[]>;
	/** (Re)indexes a page from its latest version. */
	indexPage(pageId: string): Promise<void>;
	removePage(pageId: string): Promise<void>;
}

/** Marks a match in snippets coming back from the database (see toSnippet). */
export const MATCH_START = '\u0001';
export const MATCH_END = '\u0002';
