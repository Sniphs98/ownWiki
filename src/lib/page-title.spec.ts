import { describe, expect, it } from 'vitest';
import { startsWithTitle, titleFromMarkdown } from './page-title';

describe('titleFromMarkdown', () => {
	it('takes the heading on the first line, without its marks', () => {
		expect(titleFromMarkdown('# Kündigung\n\nText')).toBe('Kündigung');
		expect(titleFromMarkdown('\n\n### Ablauf ###\nText')).toBe('Ablauf');
	});

	it('shows formatting, links and escapes as they read', () => {
		expect(titleFromMarkdown('# **Neue** _Seite_ `v2`')).toBe('Neue Seite v2');
		expect(titleFromMarkdown('# Zu [Handbuch](/w/handbuch) und [[Anderes]]')).toBe(
			'Zu Handbuch und Anderes'
		);
		expect(titleFromMarkdown('# 1\\. Schritt \\*')).toBe('1. Schritt *');
	});

	it('is empty when the text doesn’t start with a heading', () => {
		expect(titleFromMarkdown('Nur ein Absatz\n# Später')).toBe('');
		expect(titleFromMarkdown('#Kein Abstand')).toBe('');
		expect(titleFromMarkdown('')).toBe('');
		expect(titleFromMarkdown('\n  \n')).toBe('');
	});
});

describe('startsWithTitle', () => {
	it('tells whether the text already opens with the title', () => {
		expect(startsWithTitle('# Handbuch\n\nText', 'Handbuch')).toBe(true);
		expect(startsWithTitle('Handbuch\n\nText', 'Handbuch')).toBe(false);
	});
});
