import { Worker } from 'node:worker_threads';
import { closesFence, fenceOpening } from '$lib/markdown-code';
import { DIAGRAM_LABELS, isDiagramKind, type DiagramKind } from '$lib/diagrams/kinds';

/**
 * Checks the diagrams in a page's markdown before an AI assistant saves it,
 * so it hears about a broken one and can fix it — instead of leaving a page
 * whose diagram shows nothing. Mermaid and BPMN are parsed for real,
 * Excalidraw must be a scene. Diagrams already in `before` (the version the
 * change starts from) aren't checked again: an old broken one shouldn't
 * keep the assistant from changing something else on the page.
 *
 * Returns what's wrong, one line per diagram; empty if all is well.
 */
export async function checkDiagrams(markdown: string, before = ''): Promise<string[]> {
	const unchanged = new Set(diagramBlocks(before).map((block) => block.source));
	const problems: string[] = [];
	let counts: Partial<Record<DiagramKind, number>> = {};
	for (const block of diagramBlocks(markdown)) {
		counts = { ...counts, [block.kind]: (counts[block.kind] ?? 0) + 1 };
		if (unchanged.has(block.source)) continue;
		const problem = await CHECKS[block.kind](block.source);
		if (problem) problems.push(`${DIAGRAM_LABELS[block.kind]} ${counts[block.kind]}: ${problem}`);
	}
	return problems;
}

export interface DiagramBlock {
	kind: DiagramKind;
	source: string;
}

/** The ```mermaid, ```bpmn and ```excalidraw blocks in markdown, in order. */
export function diagramBlocks(markdown: string): DiagramBlock[] {
	const blocks: DiagramBlock[] = [];
	let open: { marker: string; kind: DiagramKind | null; lines: string[] } | null = null;
	for (const line of markdown.split('\n')) {
		if (open) {
			if (closesFence(line, open.marker)) {
				if (open.kind) blocks.push({ kind: open.kind, source: open.lines.join('\n') });
				open = null;
			} else {
				open.lines.push(line);
			}
			continue;
		}
		const opening = fenceOpening(line);
		if (opening) {
			const language = opening.info.split(/\s/)[0];
			open = {
				marker: opening.marker,
				kind: isDiagramKind(language) ? (language.toLowerCase() as DiagramKind) : null,
				lines: []
			};
		}
	}
	return blocks;
}

const CHECKS: Record<DiagramKind, (source: string) => Promise<string | null>> = {
	mermaid: checkMermaid,
	bpmn: checkBpmn,
	excalidraw: async (source) => checkExcalidraw(source)
};

/** An Excalidraw scene as the editor saves it: JSON with a list of elements. */
export function checkExcalidraw(source: string): string | null {
	let scene: unknown;
	try {
		scene = JSON.parse(source);
	} catch {
		return 'Das ist kein gültiges JSON.';
	}
	if (
		!scene ||
		typeof scene !== 'object' ||
		!Array.isArray((scene as { elements?: unknown }).elements)
	) {
		return 'Eine Excalidraw-Szene braucht eine Liste "elements".';
	}
	return null;
}

type ModdleElement = {
	id?: string;
	$type: string;
	flowElements?: ModdleElement[];
	plane?: { planeElement?: { bpmnElement?: { id?: string } }[] };
};

/**
 * BPMN XML that bpmn-js can show: it parses, and every part of the process
 * has a place in the diagram (BPMN DI) — without one, it isn't drawn.
 */
export async function checkBpmn(source: string): Promise<string | null> {
	const { BpmnModdle } = await import('bpmn-moddle');
	let definitions: { rootElements?: ModdleElement[]; diagrams?: ModdleElement[] };
	try {
		definitions = (await new BpmnModdle().fromXML(source)).rootElement as typeof definitions;
	} catch (error) {
		return `Das XML lässt sich nicht lesen: ${(error as Error).message.split('\n')[0]}`;
	}

	const diagrams = definitions.diagrams ?? [];
	if (diagrams.length === 0) {
		return 'Der Layout-Teil fehlt (bpmndi:BPMNDiagram mit Positionen) – ohne ihn wird nichts gezeichnet.';
	}
	const placed = new Set(
		diagrams.flatMap((diagram) => diagram.plane?.planeElement ?? []).map((e) => e.bpmnElement?.id)
	);
	const parts = (definitions.rootElements ?? [])
		.filter((element) => element.$type === 'bpmn:Process')
		.flatMap((process) => process.flowElements ?? []);
	const missing = parts.filter((part) => !placed.has(part.id)).map((part) => part.id);
	if (missing.length > 0) {
		return `Ohne Position im Layout (BPMNShape/BPMNEdge), also nicht gezeichnet: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`;
	}
	return null;
}

// Mermaid wants a browser's DOM (for DOMPurify). linkedom provides one —
// in a worker thread of its own, so the server's globals don't suddenly
// look like a browser's to the rest of the code.
const MERMAID_WORKER = `
const { parentPort } = require('node:worker_threads');
let mermaid;
const setup = () => (mermaid ??= (async () => {
	const { parseHTML } = await import('linkedom');
	const { window } = parseHTML('<!doctype html><html><body></body></html>');
	globalThis.window = window;
	globalThis.document = window.document;
	return (await import('mermaid')).default;
})());
parentPort.on('message', async ({ id, text }) => {
	try {
		await (await setup()).parse(text);
		parentPort.postMessage({ id, error: null });
	} catch (error) {
		parentPort.postMessage({ id, error: String(error?.message ?? error) });
	}
});
`;

const MERMAID_TIMEOUT_MS = 10_000;
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (error: string | null | undefined) => void>();

function mermaidWorker() {
	if (worker) return worker;
	// eval: resolves linkedom and mermaid from the working directory, also in the built server.
	const started = new Worker(MERMAID_WORKER, { eval: true });
	started.unref();
	started.on('message', ({ id, error }: { id: number; error: string | null }) => {
		pending.get(id)?.(error);
		pending.delete(id);
	});
	const fail = () => {
		for (const settle of pending.values()) settle(undefined);
		pending.clear();
		worker = null;
	};
	started.on('error', fail);
	started.on('exit', fail);
	return (worker = started);
}

/**
 * Mermaid's own parser. If it can't run (or takes too long), the diagram
 * counts as fine: a check that fails mustn't keep anyone from saving.
 */
export async function checkMermaid(source: string): Promise<string | null> {
	const id = nextId++;
	const error = await new Promise<string | null | undefined>((settle) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			settle(undefined);
		}, MERMAID_TIMEOUT_MS);
		pending.set(id, (result) => {
			clearTimeout(timer);
			settle(result);
		});
		mermaidWorker().postMessage({ id, text: source });
	});
	if (!error) return null;
	// "Parse error on line 3:\n…source…\n----^\nExpecting …": what and where, not the drawing.
	const lines = error.split('\n').filter((line) => line.trim() && !/^-*\^$/.test(line.trim()));
	return lines.slice(0, 3).join(' – ');
}
