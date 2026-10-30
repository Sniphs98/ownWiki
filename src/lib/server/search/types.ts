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
	/** Found by what the page is about, not by its words (semantic search). */
	byMeaning?: boolean;
}

/** Full-text search in the database (search.sqlite.ts / search.pg.ts). */
export interface SearchProvider {
	search(query: string, limit: number): Promise<SearchHit[]>;
	/** (Re)indexes a page from its latest version. */
	indexPage(pageId: string): Promise<void>;
	removePage(pageId: string): Promise<void>;
}

/** Marks a match in snippets coming back from the database (see toSnippet). */
export const MATCH_START = '\u0001';
export const MATCH_END = '\u0002';
