import { DIAGRAM_LABELS, type DiagramKind } from './kinds';

/**
 * Renders diagram source to static SVG markup. The libraries are loaded on
 * first use only — none of them is needed for pages without diagrams.
 *
 * Diagrams are always drawn in their light style on a white card (see
 * .wiki-diagram in markdown-editor.svelte), in dark mode too: a BPMN
 * process with black strokes would vanish on a dark page, and this way the
 * PDF shows exactly what the screen shows.
 */
export async function renderDiagramSvg(kind: DiagramKind, source: string): Promise<string> {
	const svg = await renderers[kind](source);
	// Drop any XML prolog/comments before the root element (bpmn-js emits
	// them): sanitized away they'd leave bare newlines, which the editor's
	// white-space: pre-wrap turns into blank lines above the diagram.
	const start = svg.indexOf('<svg');
	return start > 0 ? svg.slice(start) : svg;
}

const renderers: Record<DiagramKind, (source: string) => Promise<string>> = {
	mermaid: renderMermaid,
	bpmn: renderBpmn,
	excalidraw: renderExcalidraw
};

let mermaidId = 0;

async function renderMermaid(source: string): Promise<string> {
	const { default: mermaid } = await import('mermaid');
	// Mermaid sizes boxes and label backgrounds by measuring text: with the
	// font still loading it measures the fallback, and the boxes come out
	// misaligned with the final text.
	await Promise.all([
		document.fonts.load("400 16px 'Open Sans Variable'"),
		document.fonts.load("700 16px 'Open Sans Variable'")
	]);
	mermaid.initialize({
		startOnLoad: false,
		theme: 'default',
		securityLevel: 'strict',
		fontFamily: "'Open Sans Variable', Arial, sans-serif",
		// Plain SVG text instead of HTML in <foreignObject>: HTML labels
		// inherit the editor's paragraph styles and end up misaligned.
		htmlLabels: false,
		flowchart: { htmlLabels: false }
	});
	const { svg } = await mermaid.render(`wiki-mermaid-${++mermaidId}`, source);
	return svg;
}

async function renderBpmn(source: string): Promise<string> {
	const { default: Viewer } = await import('bpmn-js/lib/Viewer');
	// bpmn-js measures labels while importing, so it needs a laid-out
	// (if invisible) container.
	const container = document.createElement('div');
	container.style.cssText = 'position:fixed;left:-99999px;top:0;width:1200px;height:800px;';
	document.body.append(container);
	const viewer = new Viewer({ container });
	try {
		await viewer.importXML(source);
		const { svg } = await viewer.saveSVG();
		return svg;
	} finally {
		viewer.destroy();
		container.remove();
	}
}

/** Where /excalidraw-assets/[...file] serves Excalidraw's fonts from. */
const EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';

/**
 * Excalidraw fetches its hand-drawn fonts from a public CDN unless told
 * otherwise; a self-hosted wiki serves them itself.
 */
export function useLocalExcalidrawAssets() {
	(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
		EXCALIDRAW_ASSET_PATH;
}

async function renderExcalidraw(source: string): Promise<string> {
	useLocalExcalidrawAssets();
	const { exportToSvg } = await import('@excalidraw/excalidraw');
	const scene = JSON.parse(source || '{}');
	const svg = await exportToSvg({
		elements: scene.elements ?? [],
		appState: {
			...scene.appState,
			exportBackground: true,
			viewBackgroundColor: '#ffffff',
			exportWithDarkMode: false,
			exportEmbedScene: false
		},
		files: scene.files ?? {}
	});
	return svg.outerHTML;
}

const pending = new Set<Promise<unknown>>();

/**
 * Resolves once every diagram render started so far has finished. The print
 * view waits for this before paginating, so no diagram is caught half-way.
 */
export async function whenDiagramsRendered() {
	while (pending.size > 0) await Promise.allSettled([...pending]);
}

/**
 * The HTML Crepe shows in place of a diagram code block: the rendered SVG
 * on a card, plus an edit button (wired up by markdown-editor.svelte via
 * the data-diagram-edit attribute — Crepe sanitizes this HTML, so it can't
 * carry event handlers). Never rejects: errors render as a message.
 */
export function renderDiagramPreview(kind: DiagramKind, source: string): Promise<string> {
	const job = renderDiagramSvg(kind, source)
		.then((svg) => `<div class="wiki-diagram-canvas">${svg}</div>`)
		.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			return `<div class="wiki-diagram-error">${escapeHtml(`${DIAGRAM_LABELS[kind]} konnte nicht dargestellt werden: ${message}`)}</div>`;
		})
		.then(
			(body) =>
				`<div class="wiki-diagram" data-diagram="${kind}">${body}` +
				`<button type="button" class="wiki-diagram-edit" data-diagram-edit="${kind}">Bearbeiten</button></div>`
		);
	pending.add(job);
	job.finally(() => pending.delete(job));
	return job;
}

function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
