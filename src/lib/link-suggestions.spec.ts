import { describe, expect, it } from 'vitest';
import { linkTextFor, openLinkQuery, suggestLinkTargets } from './link-suggestions';

const pages = [
	{ title: 'Urlaubsantrag', path: 'hr/urlaubsantrag' },
	{ title: 'Kein Urlaub', path: 'hr/kein-urlaub' },
	{ title: 'Onboarding', path: 'hr/onboarding' },
	{ title: 'Laptop', path: 'it/geraete-urlaub' },
	{ title: 'Onboarding', path: 'it/onboarding' }
];

describe('openLinkQuery', () => {
	it('finds an unfinished [[ before the cursor', () => {
		expect(openLinkQuery('Siehe [[Urlau')).toEqual({ query: 'Urlau', length: 7 });
		expect(openLinkQuery('Siehe [[')).toEqual({ query: '', length: 2 });
	});

	it('not once the link is closed, labelled or on another line', () => {
		expect(openLinkQuery('Siehe [[Urlaub]] und')).toBeNull();
		expect(openLinkQuery('[[Urlaub|Lab')).toBeNull();
		expect(openLinkQuery('[[Urlaub#Fri')).toBeNull();
		expect(openLinkQuery('Ein [Link')).toBeNull();
	});
});

describe('suggestLinkTargets', () => {
	it('puts titles that start with it first, then titles and paths containing it', () => {
		expect(suggestLinkTargets('urlaub', pages).map((p) => p.title)).toEqual([
			'Urlaubsantrag',
			'Kein Urlaub',
			'Laptop'
		]);
	});

	it('offers everything, up to the limit, before anything is typed', () => {
		expect(suggestLinkTargets('', pages, 3)).toHaveLength(3);
		expect(suggestLinkTargets('quokka', pages)).toEqual([]);
	});
});

describe('linkTextFor', () => {
	it('uses the title, or the path when the title is taken twice', () => {
		expect(linkTextFor(pages[0], pages)).toBe('Urlaubsantrag');
		expect(linkTextFor(pages[4], pages)).toBe('it/onboarding|Onboarding');
	});
});
