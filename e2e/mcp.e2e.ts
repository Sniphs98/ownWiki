import { expect, test, type APIRequestContext } from '@playwright/test';
import { FULL_PORT, MCP_TOKEN } from '../playwright.config';

// The private wiki: AI assistants get in with the MCP token, without a login.
const baseURL = `http://localhost:${FULL_PORT}`;
test.use({ baseURL });

const MCP_HEADERS = { accept: 'application/json, text/event-stream' };

async function rpc(
	request: APIRequestContext,
	method: string,
	params: object,
	address = `/mcp/${MCP_TOKEN}`
) {
	return request.post(address, {
		data: { jsonrpc: '2.0', id: 1, method, params },
		headers: MCP_HEADERS
	});
}

/** Calls a tool and returns its JSON result. */
async function callTool(request: APIRequestContext, name: string, args: object) {
	const response = await rpc(request, 'tools/call', { name, arguments: args });
	expect(response.ok()).toBe(true);
	const body = await response.json();
	return JSON.parse(body.result.content[0].text);
}

test('without the token, the endpoint stays closed', async ({ request }) => {
	expect((await rpc(request, 'tools/list', {}, '/mcp')).status()).toBe(401);
	expect((await rpc(request, 'tools/list', {}, '/mcp/falsch')).status()).toBe(401);
});

test('the token works as bearer header and in the address', async ({ request }) => {
	const viaHeader = await request.post('/mcp', {
		data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
		headers: { ...MCP_HEADERS, authorization: `Bearer ${MCP_TOKEN}` }
	});
	expect(viaHeader.ok()).toBe(true);
	const tools = (await viaHeader.json()).result.tools.map((t: { name: string }) => t.name);
	expect(tools).toEqual(['search', 'fetch', 'list_pages', 'get_backlinks']);

	const viaAddress = await rpc(request, 'initialize', {
		protocolVersion: '2025-06-18',
		capabilities: {},
		clientInfo: { name: 'e2e', version: '1' }
	});
	expect((await viaAddress.json()).result.serverInfo.name).toBe('ownwiki');
});

test('search, fetch and list pages', async ({ request }) => {
	const { results } = await callTool(request, 'search', { query: 'Sicherung' });
	expect(results[0]).toMatchObject({
		id: 'e2e/handbuch/betrieb',
		title: 'Betrieb',
		url: `${baseURL}/w/e2e/handbuch/betrieb`
	});

	const page = await callTool(request, 'fetch', { id: 'e2e/handbuch/betrieb' });
	expect(page.text).toContain('Täglich um 2 Uhr.');
	expect(page.metadata.version).toBeGreaterThanOrEqual(1);

	const { pages } = await callTool(request, 'list_pages', { prefix: 'e2e/handbuch' });
	expect(pages.map((p: { id: string }) => p.id)).toEqual([
		'e2e/handbuch',
		'e2e/handbuch/betrieb',
		'e2e/handbuch/einrichtung'
	]);

	const missing = await rpc(request, 'tools/call', {
		name: 'fetch',
		arguments: { id: 'gibt/es/nicht' }
	});
	expect((await missing.json()).result.isError).toBe(true);
});
