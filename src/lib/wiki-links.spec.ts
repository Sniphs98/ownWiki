import { describe, expect, it } from 'vitest';
import {
	bindTargets,
	linkedPagePaths,
	linkTargetResolver,
	linkTargets,
	refreshWikiLinks,
	resolveWikiLinks
} from './wiki-links';

const pages = [
	{ title: 'Kündigung', path: 'personal/kuendigung' },
	{ title: 'Onboarding', path: 'personal/onboarding' }
];

describe('resolveWikiLinks', () => {
	it('links existing pages by title or path, case-insensitively, showing their title', () => {
		expect(resolveWikiLinks('Siehe [[kündigung]].', pages)).toBe(
			'Siehe [Kündigung](/w/personal/kuendigung).'
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

	it('leaves code blocks and inline code as written', () => {
		const shell = '```bash\nif [[ -f "$file" ]]; then\n  echo [[Kündigung]]\nfi\n```';
		expect(resolveWikiLinks(shell, pages)).toBe(shell);
		expect(resolveWikiLinks('Schreibe `[[Kündigung]]` für [[Kündigung]].', pages)).toBe(
			'Schreibe `[[Kündigung]]` für [Kündigung](/w/personal/kuendigung).'
		);
		expect(resolveWikiLinks('~~~~\n```\n[[Kündigung]]\n```\n~~~~\n[[Onboarding]]', pages)).toBe(
			'~~~~\n```\n[[Kündigung]]\n```\n~~~~\n[Onboarding](/w/personal/onboarding)'
		);
	});

	it('understands the escaped label separator Milkdown writes in tables', () => {
		expect(resolveWikiLinks('| \\[\\[Onboarding\\|Start]] |', pages)).toBe(
			'| [Start](/w/personal/onboarding) |'
		);
	});

	it('links to a heading on a page', () => {
		expect(resolveWikiLinks('[[Kündigung#Fristen und Termine|Fristen]]', pages)).toBe(
			'[Fristen](/w/personal/kuendigung#fristen-und-termine)'
		);
		expect(resolveWikiLinks('[[#Übersicht]]', pages)).toBe('[#Übersicht](#%C3%BCbersicht)');
		// A missing page is created without the heading in its name.
		expect(resolveWikiLinks('[[Neu#Teil]]', pages)).toBe(
			'[Neu#Teil](/w/neu/edit?title=Neu "Seite existiert noch nicht – klicken zum Erstellen")'
		);
	});
});

describe('linkedPagePaths', () => {
	it('finds pages linked by wiki link or by /w/ link, each once', () => {
		const markdown = [
			'Siehe \\[\\[Kündigung#Fristen]] und [[personal/onboarding|Start]].',
			'Nochmal [Onboarding](/w/personal/onboarding#ablauf) und [[Kündigung]].'
		].join('\n');
		expect(linkedPagePaths(markdown, pages)).toEqual([
			'personal/kuendigung',
			'personal/onboarding'
		]);
	});

	it('ignores missing pages and links in code', () => {
		const markdown = '[[Neue Seite]] `[[Kündigung]]`\n\n```\n[x](/w/personal/onboarding)\n```\n';
		expect(linkedPagePaths(markdown, pages)).toEqual([]);
	});
});

describe('linkTargets', () => {
	it('keeps what links point to as written, so pages created later count', () => {
		const markdown = [
			'\\[\\[Neue Seite#Teil]], [[personal/onboarding|Start]] und [x](/w/Personal/Kuendigung#a).',
			'`[[im Code]]` und nochmal [[neue seite]].'
		].join('\n');
		expect(linkTargets(markdown)).toEqual([
			'neue seite',
			'personal/onboarding',
			'/personal/kuendigung'
		]);
	});
});

describe('linkTargetResolver', () => {
	it('resolves wiki links by path or title, /w/ links by path only', () => {
		const resolve = linkTargetResolver([...pages, { title: 'personal/x', path: 'andere' }]);
		expect(resolve('kündigung')).toBe('personal/kuendigung');
		expect(resolve('personal/onboarding')).toBe('personal/onboarding');
		expect(resolve('personal/x')).toBe('andere');
		expect(resolve('/personal/kuendigung')).toBe('personal/kuendigung');
		expect(resolve('/kündigung')).toBeUndefined();
		expect(resolve('fehlt')).toBeUndefined();
	});
});

// "Urlaub" was renamed to "Urlaubsantrag" and moved to hr/urlaubsantrag after
// the page linking to it was saved; then someone made a new page "Urlaub".
const renamed = { title: 'Urlaubsantrag', path: 'hr/urlaubsantrag' };
const newcomer = { title: 'Urlaub', path: 'neu/urlaub' };
const later = [...pages, renamed, newcomer];
const bound = new Map([
	['urlaub', renamed],
	['/personal/urlaub', renamed]
]);

describe('links bound to their page', () => {
	it('keep leading to it after a move or rename, showing its title now', () => {
		expect(resolveWikiLinks('[[Urlaub]] und [[Urlaub|hier]]', later, bound)).toBe(
			'[Urlaubsantrag](/w/hr/urlaubsantrag) und [hier](/w/hr/urlaubsantrag)'
		);
		expect(resolveWikiLinks('[Antrag](/w/personal/urlaub#fristen)', later, bound)).toBe(
			'[Antrag](/w/hr/urlaubsantrag#fristen)'
		);
		// Unbound, the same text means the new page.
		expect(resolveWikiLinks('[[Urlaub]]', later)).toBe('[Urlaub](/w/neu/urlaub)');
		expect(linkedPagePaths('[[Urlaub]]', later, bound)).toEqual(['hr/urlaubsantrag']);
	});

	it('are written with the current name for the editor, keeping labels and escaping', () => {
		expect(
			refreshWikiLinks(
				'\\[\\[Urlaub#Fristen]], [[urlaub|hier]], | \\[\\[Urlaub\\|Zelle]] |, [[Kündigung]], `[[Urlaub]]`',
				later,
				bound
			)
		).toBe(
			'\\[\\[Urlaubsantrag#Fristen]], [[Urlaubsantrag|hier]], | \\[\\[Urlaubsantrag\\|Zelle]] |, [[Kündigung]], `[[Urlaub]]`'
		);
		// Two pages with that title: the path is unambiguous.
		const twin = { title: 'Urlaubsantrag', path: 'alt/urlaubsantrag' };
		expect(refreshWikiLinks('[[Urlaub]]', [...later, twin], bound)).toBe('[[hr/urlaubsantrag]]');
	});
});

describe('bindTargets', () => {
	const withIds = later.map((p) => ({ ...p, id: `id:${p.path}` }));

	it('keeps an existing binding, binds new links now, and leaves missing pages unbound', () => {
		const previous = new Map<string, string | null>([
			['urlaub', 'id:hr/urlaubsantrag'],
			['weg', 'id:geloescht']
		]);
		expect(bindTargets(['urlaub', 'kündigung', 'weg', 'fehlt'], previous, withIds)).toEqual([
			{ target: 'urlaub', pageId: 'id:hr/urlaubsantrag' },
			{ target: 'kündigung', pageId: 'id:personal/kuendigung' },
			{ target: 'weg', pageId: null },
			{ target: 'fehlt', pageId: null }
		]);
	});
});
