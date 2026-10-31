import { describe, expect, it } from 'vitest';
import { DIAGRAM_TEMPLATES } from '$lib/diagrams/kinds';
import {
	checkBpmn,
	checkDiagrams,
	checkExcalidraw,
	checkMermaid,
	diagramBlocks
} from './diagram-check';

const fence = (kind: string, source: string) => `\`\`\`${kind}\n${source}\n\`\`\``;

const bpmnWithoutLayout = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">
  <bpmn:process id="p"><bpmn:startEvent id="Start" /></bpmn:process>
</bpmn:definitions>`;

describe('diagramBlocks', () => {
	it('finds the diagram code blocks, not other code', () => {
		const markdown = [
			'Text',
			fence('mermaid', 'flowchart TD\n  A --> B'),
			fence('js', 'const a = 1;'),
			'````md',
			fence('bpmn', 'nur ein Beispiel'),
			'````',
			fence('Excalidraw', '{}')
		].join('\n');
		expect(diagramBlocks(markdown)).toEqual([
			{ kind: 'mermaid', source: 'flowchart TD\n  A --> B' },
			{ kind: 'excalidraw', source: '{}' }
		]);
	});
});

describe('the checks', () => {
	it('take the templates the editor inserts as they are', async () => {
		expect(await checkMermaid(DIAGRAM_TEMPLATES.mermaid)).toBeNull();
		expect(await checkBpmn(DIAGRAM_TEMPLATES.bpmn)).toBeNull();
		expect(checkExcalidraw(DIAGRAM_TEMPLATES.excalidraw)).toBeNull();
	});

	it('say what is wrong with a broken Mermaid diagram', async () => {
		expect(await checkMermaid('flowchart TD\n  A[Start] -->\n  B -->|Ja C[Ende')).toMatch(
			/Parse error on line 3/
		);
		expect(await checkMermaid('kein Diagramm')).toMatch(/No diagram type detected/);
	});

	it('refuse BPMN that does not parse, or has nothing to draw it with', async () => {
		expect(await checkBpmn('<nicht xml')).toMatch(/lässt sich nicht lesen/);
		expect(await checkBpmn(bpmnWithoutLayout)).toMatch(/Layout-Teil fehlt/);
		const halfDrawn = DIAGRAM_TEMPLATES.bpmn.replace(
			'<bpmn:startEvent id="StartEvent_1" name="Start" />',
			'<bpmn:startEvent id="StartEvent_1" name="Start" /><bpmn:endEvent id="Ende" />'
		);
		expect(await checkBpmn(halfDrawn)).toMatch(/nicht gezeichnet: Ende/);
	});

	it('want an Excalidraw scene', () => {
		expect(checkExcalidraw('{ kaputt')).toMatch(/kein gültiges JSON/);
		expect(checkExcalidraw('{"type":"excalidraw"}')).toMatch(/"elements"/);
	});
});

describe('checkDiagrams', () => {
	it('names each broken diagram, and leaves unchanged ones alone', async () => {
		const brokenMermaid = fence('mermaid', 'flowchart TD\n  A -->');
		const before = `# Seite\n\n${brokenMermaid}\n`;
		const after = `${before}\n${fence('bpmn', bpmnWithoutLayout)}\n${fence('excalidraw', '{"elements": []}')}`;
		expect(await checkDiagrams(after, before)).toEqual([
			expect.stringMatching(/^BPMN-Prozess 1: Der Layout-Teil fehlt/)
		]);
		expect(await checkDiagrams(after)).toEqual([
			expect.stringMatching(/^Mermaid-Diagramm 1: /),
			expect.stringMatching(/^BPMN-Prozess 1: /)
		]);
	});
});
