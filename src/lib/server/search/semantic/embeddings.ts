import { env } from '$env/dynamic/private';
import { normalize } from './vectors';

/**
 * Any service with OpenAI's embeddings API: OpenAI itself, Azure OpenAI
 * (…/openai/v1), or a local Ollama (http://localhost:11434/v1). Without
 * EMBEDDINGS_URL and EMBEDDINGS_MODEL there is no semantic search.
 */
const baseUrl = env.EMBEDDINGS_URL?.replace(/\/*$/, '/');
export const embeddingModel = env.EMBEDDINGS_MODEL ?? '';
const apiKey = env.EMBEDDINGS_API_KEY;
const dimensions = Number(env.EMBEDDINGS_DIMENSIONS) || undefined;

export const embeddingsConfigured = Boolean(baseUrl && embeddingModel);

/** How similar a passage must be to the query to count as a hit (cosine, -1 to 1). */
export const minScore = Number(env.EMBEDDINGS_MIN_SCORE) || 0.3;

const BATCH_SIZE = 64;

/** Embeds the texts, as normalized vectors in the same order. */
export async function embed(texts: string[], timeoutMs: number): Promise<Float32Array[]> {
	if (!baseUrl) throw new Error('EMBEDDINGS_URL is not set');
	const vectors: Float32Array[] = [];
	for (let start = 0; start < texts.length; start += BATCH_SIZE) {
		const input = texts.slice(start, start + BATCH_SIZE);
		const response = await fetch(new URL('embeddings', baseUrl), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
			},
			body: JSON.stringify({ model: embeddingModel, input, ...(dimensions ? { dimensions } : {}) }),
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (!response.ok) {
			const detail = (await response.text()).slice(0, 200);
			throw new Error(`Embeddings service answered ${response.status}: ${detail}`);
		}
		const { data } = (await response.json()) as {
			data: { index: number; embedding: number[] }[];
		};
		if (data?.length !== input.length) throw new Error('Embeddings service skipped inputs');
		for (const { embedding } of data.toSorted((a, b) => a.index - b.index)) {
			vectors.push(normalize(embedding));
		}
	}
	return vectors;
}
