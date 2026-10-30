import { describe, expect, it } from 'vitest';
import { isCrossSiteForm } from './csrf';

const form = (url: string, headers: Record<string, string> = {}, method = 'POST') => {
	const request = new Request(url, {
		method,
		headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }
	});
	return isCrossSiteForm(request, new URL(url));
};

describe('isCrossSiteForm', () => {
	it('lets forms from the wiki itself through', () => {
		expect(form('https://wiki.test/login?/signIn', { origin: 'https://wiki.test' })).toBe(false);
	});

	it('stops forms from other sites, or without an origin', () => {
		expect(form('https://wiki.test/w/x/edit?/save', { origin: 'https://evil.test' })).toBe(true);
		expect(form('https://wiki.test/w/x/edit?/save')).toBe(true);
	});

	it('lets AI assistants’ servers reach the token endpoint', () => {
		expect(form('https://wiki.test/api/auth/oauth2/token')).toBe(false);
	});

	it('leaves reads and JSON alone', () => {
		expect(form('https://wiki.test/w/x', {}, 'GET')).toBe(false);
		const json = new Request('https://wiki.test/mcp', {
			method: 'POST',
			headers: { 'content-type': 'application/json' }
		});
		expect(isCrossSiteForm(json, new URL(json.url))).toBe(false);
	});
});
