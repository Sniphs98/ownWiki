import { describe, expect, it } from 'vitest';
import { breadcrumbs, pathOptions, withAreas } from './page-paths';

describe('pathOptions', () => {
	it('never offers an empty path, so nothing looks chosen by mistake', () => {
		expect(pathOptions(['b', '', 'a', '  ', 'b'])).toEqual(['a', 'b']);
	});
});

describe('withAreas', () => {
	it('adds the areas above each page', () => {
		expect(withAreas(['personal/kuendigung', 'it', ''])).toEqual([
			'it',
			'personal',
			'personal/kuendigung'
		]);
	});
});

describe('breadcrumbs', () => {
	it('links only the parts that are pages, not folders', () => {
		expect(breadcrumbs('anleitung/editor/tabellen', ['anleitung/editor', 'x'])).toEqual([
			{ label: 'anleitung', path: 'anleitung', isPage: false },
			{ label: 'editor', path: 'anleitung/editor', isPage: true },
			{ label: 'tabellen', path: 'anleitung/editor/tabellen', isPage: false }
		]);
	});
});
