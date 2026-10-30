import { describe, expect, it } from 'vitest';
import { fromBytes, fuseRankings, normalize, similarity, toBytes } from './vectors';

describe('similarity', () => {
	it('is the cosine of normalized vectors', () => {
		expect(similarity(normalize([3, 4]), normalize([6, 8]))).toBeCloseTo(1);
		expect(similarity(normalize([1, 0]), normalize([0, 2]))).toBeCloseTo(0);
		expect(similarity(normalize([1, 0]), normalize([1, 0, 0]))).toBe(0);
	});

	it('survives the trip through the database', () => {
		const vector = normalize([1, 2, 3]);
		const stored = Buffer.concat([Buffer.from([0]), toBytes(vector)]).subarray(1);
		expect([...fromBytes(stored)]).toEqual([...vector]);
	});
});

describe('fuseRankings', () => {
	const hits = (...ids: string[]) => ids.map((pageId) => ({ pageId, from: ids.join() }));

	it('puts pages found both ways first, then alternates', () => {
		const fused = fuseRankings([hits('a', 'b', 'c'), hits('d', 'c')]);
		expect(fused.map((hit) => hit.pageId)).toEqual(['c', 'a', 'd', 'b']);
	});

	it('keeps the entry of the first list for a page in both', () => {
		const [first] = fuseRankings([hits('a'), hits('a', 'b')]);
		expect(first).toEqual({ pageId: 'a', from: 'a' });
	});
});
