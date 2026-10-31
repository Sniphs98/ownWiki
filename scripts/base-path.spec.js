import { describe, expect, it } from 'vitest';
import { normalizeBasePath } from './base-path.js';

describe('normalizeBasePath', () => {
	it('is empty for the root', () => {
		expect(normalizeBasePath(undefined)).toBe('');
		expect(normalizeBasePath('')).toBe('');
		expect(normalizeBasePath('/')).toBe('');
	});

	it('starts with a slash and has none at the end', () => {
		expect(normalizeBasePath('/wiki')).toBe('/wiki');
		expect(normalizeBasePath('wiki/')).toBe('/wiki');
		expect(normalizeBasePath(' /intranet/wiki ')).toBe('/intranet/wiki');
	});

	it('refuses what is not a plain path', () => {
		for (const bad of ['/wiki?x=1', '/my wiki', 'https://example.org/wiki', '/a//b', '/"x']) {
			expect(() => normalizeBasePath(bad)).toThrow(/BASE_PATH/);
		}
	});
});
