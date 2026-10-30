// A stand-in for an embeddings service (OpenAI's API), for the semantic
// search tests: words of the same meaning share a dimension, every other
// word gets one of its own. So "Datensicherung" lands near a page about
// "Sicherung" without sharing a word with it — like a real model would,
// but predictable and without sending anything anywhere.
import { createServer } from 'node:http';

const FAKE_EMBEDDINGS_PORT = Number(process.env.PORT);

const MEANINGS = [
	['sicherung', 'datensicherung', 'backup', 'backups'],
	['urlaub', 'urlaubsantrag', 'ferien', 'freinehmen']
];
const DIMENSIONS = 512;

function hash(word) {
	let h = 0;
	for (const char of word) h = (h * 31 + char.codePointAt(0)) >>> 0;
	return MEANINGS.length + (h % (DIMENSIONS - MEANINGS.length));
}

function embed(text) {
	const vector = new Array(DIMENSIONS).fill(0);
	for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
		const meaning = MEANINGS.findIndex((words) => words.includes(word));
		vector[meaning === -1 ? hash(word) : meaning] += 1;
	}
	return vector;
}

createServer((request, response) => {
	if (request.method !== 'POST' || request.url !== '/v1/embeddings') {
		response.writeHead(404).end();
		return;
	}
	let body = '';
	request.on('data', (chunk) => (body += chunk));
	request.on('end', () => {
		const { input } = JSON.parse(body);
		const data = [input].flat().map((text, index) => ({ index, embedding: embed(text) }));
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify({ object: 'list', data }));
	});
}).listen(FAKE_EMBEDDINGS_PORT, () => {
	console.log(`[e2e] fake embeddings on port ${FAKE_EMBEDDINGS_PORT}`);
});
