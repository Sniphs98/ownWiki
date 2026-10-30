import { describe, expect, it } from 'vitest';
import { linkedPagePaths, resolveWikiLinks } from './wiki-links';

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
