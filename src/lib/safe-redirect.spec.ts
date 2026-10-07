import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

const origin = 'https://wiki.example';

describe('safeRedirectPath', () => {
	it('keeps paths on this wiki', () => {
		expect(safeRedirectPath('/w/personal/kuendigung?x=1#a', origin)).toBe(
			'/w/personal/kuendigung?x=1#a'
		);
	});

	it('falls back to the start page without a target', () => {
		expect(safeRedirectPath(null, origin)).toBe('/');
		expect(safeRedirectPath('', origin)).toBe('/');
	});

	it('rejects other sites', () => {
		for (const target of [
			'https://evil.example',
			'//evil.example',
			'/\\evil.example',
			'/\\/evil.example',
			'javascript:alert(1)'
		]) {
			expect(safeRedirectPath(target, origin)).toBe('/');
		}
	});
});
