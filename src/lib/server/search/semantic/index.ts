import { createHash } from 'node:crypto';
import { dbDialect } from '$lib/server/db';
import type { SearchHit } from '../types';
import { chunkPage } from './chunks';
import { embed, embeddingModel, embeddingsConfigured, minScore } from './embeddings';
import { similarity } from './vectors';
import type { ChunkStore, PageChunks, StoredChunk } from './store.types';

/**
 * Semantic search: finds pages by what they're about, not by their words
 * ("Backup" finds the section "Sicherung"). Every page is cut into chunks
 * (chunks.ts), each gets an embedding from the embeddings service, and a
 * query is compared against all of them. For a company wiki that's a few
 * thousand vectors — compared in memory in milliseconds, so the database
 * only keeps them (no vector extension needed).
 *
 * Embedding takes a request to the service, so saving a page doesn't wait
 * for it: pages are queued and embedded in the background, unchanged
 * chunks are kept. Until then, the full-text search finds them.
 */
export const semanticSearchEnabled = embeddingsConfigured;

const store: ChunkStore =
	dbDialect === 'postgresql'
		? (await import('./store.pg')).pgChunkStore
		: (await import('./store.sqlite')).sqliteChunkStore;

const QUERY_TIMEOUT_MS = 5_000;
const INDEX_TIMEOUT_MS = 60_000;
const RETRY_MS = 60_000;

const pages = new Map<string, PageChunks>();
let loaded: Promise<void> | null = null;

function load() {
	loaded ??= store
		.loadAll()
		.then((all) => {
			for (const page of all) pages.set(page.pageId, page);
		})
		.catch((error) => {
			loaded = null;
			throw error;
		});
	return loaded;
}

const hashOf = (input: string) =>
	createHash('sha256').update(`${embeddingModel}\n${input}`).digest('base64url');

async function indexOne(pageId: string) {
	const page = await store.latest(pageId);
	if (!page) {
		pages.delete(pageId);
		await store.removePage(pageId);
		return;
	}

	const chunks = chunkPage(page.title, page.content);
	const hashes = chunks.map((chunk) => hashOf(chunk.input));
	const previous = pages.get(pageId);
	const known = new Map(previous?.chunks.map((chunk) => [chunk.hash, chunk.embedding]));

	const missing = chunks.filter((_, i) => !known.has(hashes[i]));
	const vectors =
		missing.length > 0
			? await embed(
					missing.map((c) => c.input),
					INDEX_TIMEOUT_MS
				)
			: [];
	missing.forEach((chunk, i) => known.set(hashOf(chunk.input), vectors[i]));

	const stored: StoredChunk[] = chunks.map((chunk, i) => ({
		text: chunk.text,
		hash: hashes[i],
		embedding: known.get(hashes[i])!
	}));
	const unchanged =
		previous?.chunks.length === stored.length &&
		previous.chunks.every((chunk, i) => chunk.hash === stored[i].hash);
	if (!unchanged) await store.replacePage(pageId, stored);
	pages.set(pageId, { pageId, path: page.path, title: page.title, chunks: stored });
}

const queue = new Set<string>();
const failed = new Set<string>();
let draining = false;
let retry: ReturnType<typeof setTimeout> | null = null;

async function drain() {
	if (draining) return;
	draining = true;
	try {
		await load();
		for (const pageId of queue) {
			queue.delete(pageId);
			try {
				await indexOne(pageId);
				failed.delete(pageId);
			} catch (error) {
				if (failed.size === 0) console.error('[search] Embedding pages failed:', error);
				failed.add(pageId);
			}
		}
	} catch (error) {
		console.error('[search] Loading the embeddings failed:', error);
		for (const pageId of queue) failed.add(pageId);
		queue.clear();
	} finally {
		draining = false;
	}
	if (queue.size > 0) return void drain();
	// The service may be down for a while: try the failed pages again later.
	if (failed.size > 0 && !retry) {
		retry = setTimeout(() => {
			retry = null;
			for (const pageId of failed) queue.add(pageId);
			failed.clear();
			void drain();
		}, RETRY_MS);
		retry.unref?.();
	}
}

/** (Re)embeds a page from its latest version, in the background. */
export function queueSemanticIndex(pageId: string) {
	if (!semanticSearchEnabled) return;
	queue.add(pageId);
	void drain();
}

/** Embeds every page that isn't yet (or changed outside the app), and drops removed ones. */
export async function startSemanticIndex() {
	if (!semanticSearchEnabled) return;
	try {
		await load();
		const ids = await store.pageIds();
		for (const pageId of pages.keys()) if (!ids.includes(pageId)) queue.add(pageId);
		for (const pageId of ids) queue.add(pageId);
		void drain();
	} catch (error) {
		console.error('[search] Starting the semantic index failed:', error);
	}
}

/**
 * The pages whose content is closest in meaning to the query, best first,
 * with the closest passage as snippet. Never fails: without a working
 * embeddings service, the full-text search alone answers.
 */
export async function semanticSearch(query: string, limit: number): Promise<SearchHit[]> {
	if (!semanticSearchEnabled || !query.trim()) return [];
	try {
		await load();
		const [vector] = await embed([query], QUERY_TIMEOUT_MS);
		const hits: { hit: SearchHit; score: number }[] = [];
		for (const page of pages.values()) {
			let best: { score: number; text: string } | null = null;
			for (const chunk of page.chunks) {
				const score = similarity(vector, chunk.embedding);
				if (!best || score > best.score) best = { score, text: chunk.text };
			}
			if (best && best.score >= minScore) {
				const { pageId, path, title } = page;
				const snippet = best.text ? [{ text: best.text, match: false }] : [];
				hits.push({ hit: { pageId, path, title, snippet, byMeaning: true }, score: best.score });
			}
		}
		return hits
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(({ hit }) => hit);
	} catch (error) {
		console.error('[search] Semantic search failed:', error);
		return [];
	}
}
