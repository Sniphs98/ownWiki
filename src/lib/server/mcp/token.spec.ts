import { describe, expect, it } from 'vitest';
import { isMcpToken, requestMcpToken } from './token';

describe('isMcpToken', () => {
	it('accepts only the configured token', () => {
		expect(isMcpToken('geheim', 'geheim')).toBe(true);
		expect(isMcpToken('falsch', 'geheim')).toBe(false);
		expect(isMcpToken('geheim-und-mehr', 'geheim')).toBe(false);
	});

	it('accepts nothing without a configured token', () => {
		expect(isMcpToken('', '')).toBe(false);
		expect(isMcpToken('irgendwas', undefined)).toBe(false);
	});
});

describe('requestMcpToken', () => {
	it('reads a bearer header first, then the address', () => {
		const withHeader = new Request('http://wiki/mcp/aus-url', {
			headers: { authorization: 'Bearer aus-header' }
		});
		expect(requestMcpToken(withHeader, 'aus-url')).toBe('aus-header');
		expect(requestMcpToken(new Request('http://wiki/mcp/aus-url'), 'aus-url')).toBe('aus-url');
		expect(requestMcpToken(new Request('http://wiki/mcp'), undefined)).toBeNull();
	});
});
