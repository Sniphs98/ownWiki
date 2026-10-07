import { describe, expect, it } from 'vitest';
import { slugifyPath } from './slug';

describe('slugifyPath', () => {
	it('turns names into lowercase path segments', () => {
		expect(slugifyPath('Personal/Kündigung')).toBe('personal/kuendigung');
		expect(slugifyPath('Straße & Größe')).toBe('strasse-groesse');
		expect(slugifyPath('Café Crème')).toBe('cafe-creme');
	});

	it('drops empty segments and stray separators', () => {
		expect(slugifyPath('/a//b/ ')).toBe('a/b');
		expect(slugifyPath('--Hallo  Welt--')).toBe('hallo-welt');
		expect(slugifyPath('!!!')).toBe('');
	});

	it('keeps an already canonical path unchanged', () => {
		expect(slugifyPath('personal/neue-kuendigung')).toBe('personal/neue-kuendigung');
	});
});
