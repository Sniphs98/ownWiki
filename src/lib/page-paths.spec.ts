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
	it('has a crumb for every part of the path', () => {
		expect(breadcrumbs('anleitung/editor/tabellen')).toEqual([
			{ label: 'anleitung', path: 'anleitung' },
			{ label: 'editor', path: 'anleitung/editor' },
			{ label: 'tabellen', path: 'anleitung/editor/tabellen' }
		]);
	});
});
