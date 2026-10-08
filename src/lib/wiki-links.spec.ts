import { describe, expect, it } from 'vitest';
import { resolveWikiLinks } from './wiki-links';

const pages = [
	{ title: 'Kündigung', path: 'personal/kuendigung' },
	{ title: 'Onboarding', path: 'personal/onboarding' }
];

describe('resolveWikiLinks', () => {
	it('links existing pages by title or path, case-insensitively', () => {
		expect(resolveWikiLinks('Siehe [[kündigung]].', pages)).toBe(
			'Siehe [kündigung](/w/personal/kuendigung).'
		);
		expect(resolveWikiLinks('[[personal/onboarding|Start]]', pages)).toBe(
			'[Start](/w/personal/onboarding)'
		);
	});

	it('understands the escaped form Milkdown stores', () => {
		expect(resolveWikiLinks('\\[\\[Onboarding]]', pages)).toBe(
			'[Onboarding](/w/personal/onboarding)'
		);
	});

	it('links missing pages to their editor, prefilled with the name', () => {
		expect(resolveWikiLinks('[[Neue Seite]]', pages)).toBe(
			'[Neue Seite](/w/neue-seite/edit?title=Neue%20Seite "Seite existiert noch nicht – klicken zum Erstellen")'
		);
	});

	it('leaves only the label when the name has no usable characters', () => {
		expect(resolveWikiLinks('[[!!!|Text]]', pages)).toBe('Text');
	});
});
