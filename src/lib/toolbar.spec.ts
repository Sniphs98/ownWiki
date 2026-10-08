import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOLBAR, normalizeToolbar, SEPARATOR, toolbarGroups } from './toolbar';

describe('normalizeToolbar', () => {
	it('falls back to the default for anything but an array', () => {
		expect(normalizeToolbar(null)).toEqual(DEFAULT_TOOLBAR);
		expect(normalizeToolbar('bold')).toEqual(DEFAULT_TOOLBAR);
	});

	it('drops unknown keys, duplicates and superfluous separators', () => {
		expect(
			normalizeToolbar([
				SEPARATOR,
				'bold',
				'nope',
				'bold',
				SEPARATOR,
				SEPARATOR,
				'italic',
				SEPARATOR
			])
		).toEqual(['bold', SEPARATOR, 'italic']);
	});

	it('does not accept keys inherited from Object.prototype', () => {
		expect(normalizeToolbar(['toString', 'constructor'])).toEqual([]);
	});
});

describe('toolbarGroups', () => {
	it('splits the toolbar at separators', () => {
		expect(toolbarGroups(['bold', 'italic', SEPARATOR, 'link'])).toEqual([
			['bold', 'italic'],
			['link']
		]);
	});
});
