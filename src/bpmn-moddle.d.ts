// bpmn-moddle has types for the BPMN model only, not for its entry point —
// this covers the part the diagram check uses.
declare module 'bpmn-moddle' {
	export class BpmnModdle {
		fromXML(xml: string): Promise<{ rootElement: unknown; warnings: unknown[] }>;
	}
}
