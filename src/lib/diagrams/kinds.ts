/**
 * Diagrams live in the page's markdown as fenced code blocks whose language
 * names the kind (```mermaid, ```bpmn, ```excalidraw) — so they're
 * versioned, searched and exported together with the page. The code block
 * shows the rendered diagram instead of the source (see render.ts and
 * markdown-editor.svelte); a dialog edits the source.
 */
export const DIAGRAM_KINDS = ['mermaid', 'bpmn', 'excalidraw'] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

export function isDiagramKind(language: string): language is DiagramKind {
	return (DIAGRAM_KINDS as readonly string[]).includes(language.toLowerCase());
}

export const DIAGRAM_LABELS: Record<DiagramKind, string> = {
	mermaid: 'Mermaid-Diagramm',
	bpmn: 'BPMN-Prozess',
	excalidraw: 'Excalidraw-Zeichnung'
};

/** Starting content for a newly inserted diagram. */
export const DIAGRAM_TEMPLATES: Record<DiagramKind, string> = {
	mermaid: [
		'flowchart TD',
		'    A[Start] --> B{Entscheidung}',
		'    B -->|Ja| C[Weiter]',
		'    B -->|Nein| D[Ende]'
	].join('\n'),
	bpmn: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
	excalidraw: JSON.stringify(
		{
			type: 'excalidraw',
			version: 2,
			source: 'ownWiki',
			elements: [],
			appState: { viewBackgroundColor: '#ffffff' },
			files: {}
		},
		null,
		2
	)
};

/** Icons for the slash menu / toolbar (lucide, inlined as Crepe expects SVG strings). */
export const DIAGRAM_ICONS: Record<DiagramKind, string> = {
	// lucide "workflow"
	mermaid:
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>',
	// lucide "git-fork"
	bpmn: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>',
	// lucide "pen-tool"
	excalidraw:
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/></svg>'
};
