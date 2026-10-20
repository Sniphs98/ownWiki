import { describe, expect, it } from 'vitest';
import { isWebAddress, trimWebAddress, TYPED_LINK, TYPED_WEB_ADDRESS } from './link-syntax';

describe('TYPED_LINK', () => {
	it('finds [Text](address) at the end of what was typed', () => {
		expect('Siehe [Beispiel](https://example.org)'.match(TYPED_LINK)?.slice(1)).toEqual([
			'Beispiel',
			'https://example.org'
		]);
		expect('[Handbuch](/w/e2e/handbuch)'.match(TYPED_LINK)?.slice(1)).toEqual([
			'Handbuch',
			'/w/e2e/handbuch'
		]);
	});

	it('leaves images, wiki links and unfinished links alone', () => {
		expect('![Logo](/logo.png)').not.toMatch(TYPED_LINK);
		expect('[[Seite]]').not.toMatch(TYPED_LINK);
		expect('[Text](https://example.org) weiter').not.toMatch(TYPED_LINK);
		expect('[Text](mit leerzeichen)').not.toMatch(TYPED_LINK);
	});
});

describe('TYPED_WEB_ADDRESS', () => {
	it('finds an address followed by a space', () => {
		expect('Siehe https://example.org/a '.match(TYPED_WEB_ADDRESS)?.[1]).toBe(
			'https://example.org/a'
		);
		expect('http://intranet:8080 '.match(TYPED_WEB_ADDRESS)?.[1]).toBe('http://intranet:8080');
	});

	it('needs the address to stand on its own', () => {
		expect('xhttps://example.org ').not.toMatch(TYPED_WEB_ADDRESS);
		expect('https://example.org').not.toMatch(TYPED_WEB_ADDRESS);
	});
});

describe('trimWebAddress', () => {
	it('drops punctuation that ends the sentence', () => {
		expect(trimWebAddress('https://example.org.')).toBe('https://example.org');
		expect(trimWebAddress('https://example.org/a?b=1!')).toBe('https://example.org/a?b=1');
		expect(trimWebAddress('https://example.org),')).toBe('https://example.org');
	});

	it('keeps parentheses that belong to the address', () => {
		expect(trimWebAddress('https://de.wikipedia.org/wiki/Ticket_(Begriff).')).toBe(
			'https://de.wikipedia.org/wiki/Ticket_(Begriff)'
		);
	});

	it('is empty when no address is left', () => {
		expect(trimWebAddress('https://.')).toBe('');
	});
});

describe('isWebAddress', () => {
	it('accepts one web address', () => {
		expect(isWebAddress('https://example.org')).toBe(true);
		expect(isWebAddress('http://localhost:3000/w/seite#teil')).toBe(true);
	});

	it('rejects anything else', () => {
		for (const text of [
			'example.org',
			'https://example.org und mehr',
			'mailto:a@b.de',
			'https://'
		]) {
			expect(isWebAddress(text), text).toBe(false);
		}
	});
});
