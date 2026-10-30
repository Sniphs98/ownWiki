import { describe, expect, it } from 'vitest';
import { MAX_TAGS, normalizeTag, parseTags } from './tags';

describe('normalizeTag', () => {
	it('lowercases and joins words, keeping umlauts', () => {
		expect(normalizeTag('  #Neue Mitarbeiter ')).toBe('neue-mitarbeiter');
		expect(normalizeTag('Prüfung_2026')).toBe('prüfung_2026');
		expect(normalizeTag('a -- b!')).toBe('a-b');
		expect(normalizeTag('!!!')).toBe('');
	});
});

describe('parseTags', () => {
	it('splits on commas, drops empty ones and repeats', () => {
		expect(parseTags('HR, urlaub ,, #hr, Neue Mitarbeiter')).toEqual([
			'hr',
			'urlaub',
			'neue-mitarbeiter'
		]);
		expect(parseTags(['IT', 'it', ''])).toEqual(['it']);
	});

	it('keeps at most MAX_TAGS', () => {
		const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `t${i}`);
		expect(parseTags(many)).toHaveLength(MAX_TAGS);
	});
});
