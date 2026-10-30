export interface StoredChunk {
	text: string;
	/** Of the embedded input and the model, so changed chunks are told apart. */
	hash: string;
	embedding: Float32Array;
}

export interface PageChunks {
	pageId: string;
	path: string;
	title: string;
	chunks: StoredChunk[];
}

export interface PageText {
	id: string;
	path: string;
	title: string;
	content: string;
}

/**
 * Where the embeddings are kept: a plain table next to the full-text
 * index, created on first use like it (no database extension needed —
 * the search itself runs in memory, see semantic/index.ts).
 */
export interface ChunkStore {
	loadAll(): Promise<PageChunks[]>;
	pageIds(): Promise<string[]>;
	latest(pageId: string): Promise<PageText | undefined>;
	replacePage(pageId: string, chunks: StoredChunk[]): Promise<void>;
	removePage(pageId: string): Promise<void>;
}
