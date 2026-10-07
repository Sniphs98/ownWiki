import { describe, expect, it } from 'vitest';
import { germanPrefix, markdownToSearchText, queryTerms, toSnippet } from './text';

describe('markdownToSearchText', () => {
	it('keeps the words and drops the markup', () => {
		const markdown = [
			'# Titel',
			'',
			'Ein **fetter** und *kursiver* Satz mit `code` und [Link](https://example.org).',
			'',
			'- [ ] Aufgabe',
			'1. Schritt',
			'> Zitat',
			'',
			'| Spalte | Wert |',
			'| --- | --- |',
			'| A | 1 |',
			'',
			'![Diagramm](/api/files/abc)',
			'Siehe \\[\\[Onboarding|Einstieg]] und [[IT-Ausstattung]].'
		].join('\n');
		expect(markdownToSearchText(markdown)).toBe(
			'Titel Ein fetter und kursiver Satz mit code und Link. Aufgabe Schritt Zitat Spalte Wert A 1 Diagramm Siehe Einstieg und IT-Ausstattung.'
		);
	});

	it('indexes code but not diagram sources', () => {
		const markdown = [
			'Vorher',
			'```bash',
			'ping intranet',
			'```',
			'```bpmn',
			'<bpmn:definitions><bpmn:task name="Geheim" /></bpmn:definitions>',
			'```',
			'```excalidraw',
			'{"elements": []}',
			'```',
			'Nachher'
		].join('\n');
		expect(markdownToSearchText(markdown)).toBe('Vorher ping intranet Nachher');
	});
});

describe('toSnippet', () => {
	it('splits on the match marks', () => {
		expect(toSnippet('vor \u0001Treffer\u0002 nach')).toEqual([
			{ text: 'vor ', match: false },
			{ text: 'Treffer', match: true },
			{ text: ' nach', match: false }
		]);
	});
});

describe('queryTerms', () => {
	it('keeps only words, so nothing breaks out of the query syntax', () => {
		expect(queryTerms('Kündigung" OR * NEAR(x) -- Straße 2024')).toEqual([
			'kündigung',
			'or',
			'near',
			'x',
			'straße',
			'2024'
		]);
	});
});

describe('germanPrefix', () => {
	it('cuts common German endings', () => {
		expect(germanPrefix('kündigungen')).toBe('kündigung');
		expect(germanPrefix('abschnitte')).toBe('abschnitt');
		expect(germanPrefix('zuständigkeiten')).toBe('zuständigkeit');
		expect(germanPrefix('vpn')).toBe('vpn');
	});
});
