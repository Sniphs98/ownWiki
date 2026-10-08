import { describe, expect, it } from 'vitest';
import { attachmentHeaders, isInlineType } from './attachment-headers';

const file = (mimeType: string) => ({ filename: 'Handbuch v2.html', mimeType, size: 42 });

describe('isInlineType', () => {
	it('allows images, PDFs, plain text, audio and video', () => {
		for (const type of [
			'image/png',
			'IMAGE/JPEG',
			'application/pdf',
			'text/plain; charset=utf-8'
		]) {
			expect(isInlineType(type)).toBe(true);
		}
		expect(isInlineType('video/mp4')).toBe(true);
		expect(isInlineType('audio/mpeg')).toBe(true);
	});

	it('rejects types that can carry scripts', () => {
		for (const type of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/xml', '']) {
			expect(isInlineType(type)).toBe(false);
		}
	});
});

describe('attachmentHeaders', () => {
	it('serves HTML as a sandboxed download', () => {
		const headers = attachmentHeaders(file('text/html'));
		expect(headers['content-disposition']).toBe("attachment; filename*=UTF-8''Handbuch%20v2.html");
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['content-security-policy']).toContain('sandbox');
	});

	it('keeps the type of an SVG, so it still renders in an <img>', () => {
		const headers = attachmentHeaders(file('image/svg+xml'));
		expect(headers['content-type']).toBe('image/svg+xml');
		expect(headers['content-disposition']).toMatch(/^attachment;/);
	});

	it('shows images inline, sandboxed', () => {
		const headers = attachmentHeaders(file('image/png'));
		expect(headers['content-type']).toBe('image/png');
		expect(headers['content-disposition']).toMatch(/^inline;/);
		expect(headers['content-security-policy']).toContain('sandbox');
	});

	it('shows PDFs inline without a sandbox, which Chromium would refuse to render', () => {
		const headers = attachmentHeaders(file('application/pdf'));
		expect(headers['content-disposition']).toMatch(/^inline;/);
		expect(headers['content-security-policy']).toBeUndefined();
	});
});
