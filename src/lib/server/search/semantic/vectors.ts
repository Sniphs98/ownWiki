/** Scales a vector to length 1, so the dot product is the cosine similarity. */
export function normalize(vector: ArrayLike<number>): Float32Array {
	const result = Float32Array.from(vector);
	let length = 0;
	for (const value of result) length += value * value;
	length = Math.sqrt(length);
	if (length > 0) for (let i = 0; i < result.length; i++) result[i] /= length;
	return result;
}

/** Cosine similarity of two normalized vectors (0 if their sizes differ). */
export function similarity(a: Float32Array, b: Float32Array): number {
	if (a.length !== b.length) return 0;
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

export const toBytes = (vector: Float32Array) =>
	Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);

/** Copies, since a Buffer from the database may not be aligned for floats. */
export const fromBytes = (bytes: Uint8Array) =>
	new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

/**
 * Merges ranked lists of pages by reciprocal rank fusion: a page high in
 * both lists beats one at the top of only one. Scores of the lists aren't
 * comparable (bm25 vs. cosine), their ranks are. On a tie, the earlier
 * list wins; a page appearing twice keeps its entry from the earlier list.
 */
export function fuseRankings<T extends { pageId: string }>(lists: T[][], k = 60): T[] {
	const fused = new Map<string, { hit: T; score: number; list: number }>();
	lists.forEach((hits, list) => {
		hits.forEach((hit, rank) => {
			const score = 1 / (k + rank + 1);
			const entry = fused.get(hit.pageId);
			if (entry) entry.score += score;
			else fused.set(hit.pageId, { hit, score, list });
		});
	});
	return [...fused.values()]
		.sort((a, b) => b.score - a.score || a.list - b.list)
		.map((entry) => entry.hit);
}
