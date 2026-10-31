import { describe, expect, it } from 'vitest';
import { chunkPage, splitText } from './chunks';

describe('chunkPage', () => {
	it('makes one chunk per section, with the title and headings above it', () => {
		const markdown = [
			'# Betrieb',
			'',
			'Was im Betrieb anfällt.',
			'',
			'## Sicherung',
			'',
			'Täglich um **2 Uhr**.',
			'',
			'### Prüfung',
			'',
			'Jeden Montag.',
			'',
			'## Updates',
			'',
			'Monatlich.'
		].join('\n');
		expect(chunkPage('Betrieb', markdown)).toEqual([
			{ input: 'Betrieb\nWas im Betrieb anfällt.', text: 'Was im Betrieb anfällt.' },
			{ input: 'Betrieb › Sicherung\nTäglich um 2 Uhr.', text: 'Täglich um 2 Uhr.' },
			{ input: 'Betrieb › Sicherung › Prüfung\nJeden Montag.', text: 'Jeden Montag.' },
			{ input: 'Betrieb › Updates\nMonatlich.', text: 'Monatlich.' }
		]);
	});

	it("doesn't take a # in code for a heading, and skips diagram sources", () => {
		const markdown = [
			'Vorher.',
			'```bash',
			'# kein Titel',
			'ls',
			'```',
			'```mermaid',
			'graph TD; A-->B',
			'```'
		].join('\n');
		expect(chunkPage('Seite', markdown)).toEqual([
			{ input: 'Seite\nVorher. kein Titel ls', text: 'Vorher. kein Titel ls' }
		]);
	});

	it('keeps a page with only a title findable by it', () => {
		expect(chunkPage('Leere Seite', '# Leere Seite\n')).toEqual([
			{ input: 'Leere Seite', text: '' }
		]);
	});
});

describe('splitText', () => {
	it('cuts at sentence ends, and between words when a sentence is too long', () => {
		expect(splitText('Eins zwei. Drei vier. Fünf.', 12)).toEqual([
			'Eins zwei.',
			'Drei vier.',
			'Fünf.'
		]);
		expect(splitText('Eins. Zwei.', 20)).toEqual(['Eins. Zwei.']);
		expect(splitText('aaaa bbbb cccc dddd', 9)).toEqual(['aaaa bbbb', 'cccc dddd']);
	});
});
