import { describe, expect, it } from 'vitest';
import { addBasePath, removeBasePath } from './content-paths';

const stored = [
	'Siehe [HR](/w/hr/urlaub#fristen) und ![Plan](/api/files/abc "Plan").',
	'Extern: [Doku](https://example.org/x), [CDN](//cdn.example.org/y), [oben](#top).',
	'```md',
	'[im Code](/w/bleibt)',
	'```',
	'Inline `[code](/w/auch)` bleibt.'
].join('\n');

describe('addBasePath', () => {
	it('puts the base path before links to this server, nowhere else', () => {
		expect(addBasePath(stored, '/wiki')).toBe(
			[
				'Siehe [HR](/wiki/w/hr/urlaub#fristen) und ![Plan](/wiki/api/files/abc "Plan").',
				'Extern: [Doku](https://example.org/x), [CDN](//cdn.example.org/y), [oben](#top).',
				'```md',
				'[im Code](/w/bleibt)',
				'```',
				'Inline `[code](/w/auch)` bleibt.'
			].join('\n')
		);
	});

	it('leaves everything as it is at the root', () => {
		expect(addBasePath(stored, '')).toBe(stored);
		expect(removeBasePath(stored, '')).toBe(stored);
	});
});

describe('removeBasePath', () => {
	it('gives back what is stored, also for links the editor added under the base path', () => {
		expect(removeBasePath(addBasePath(stored, '/intra.net/wiki'), '/intra.net/wiki')).toBe(stored);
		expect(removeBasePath('[neu](/wiki/api/files/x) [anders](/wikis/x)', '/wiki')).toBe(
			'[neu](/api/files/x) [anders](/wikis/x)'
		);
	});
});
