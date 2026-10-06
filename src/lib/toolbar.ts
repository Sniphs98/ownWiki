/**
 * The editor toolbar is a list of item keys in display order, with
 * SEPARATOR entries splitting it into groups. Each user can choose which
 * items to show and in which order (settings page); the editor renders it
 * (editor-toolbar.svelte), and editor-commands.ts implements the items.
 */
export const SEPARATOR = '|';

export const TOOLBAR_ITEMS = {
	heading: 'Absatzformat',
	bold: 'Fett',
	italic: 'Kursiv',
	strikethrough: 'Durchgestrichen',
	code: 'Inline-Code',
	'bullet-list': 'Aufzählung',
	'ordered-list': 'Nummerierte Liste',
	'task-list': 'Checkliste',
	link: 'Link',
	image: 'Bild',
	file: 'Datei',
	table: 'Tabelle',
	'code-block': 'Codeblock',
	math: 'Formel',
	quote: 'Zitat',
	hr: 'Trennlinie',
	mermaid: 'Mermaid-Diagramm',
	bpmn: 'BPMN-Prozess',
	excalidraw: 'Excalidraw-Zeichnung'
} as const;

export type ToolbarItemKey = keyof typeof TOOLBAR_ITEMS;
export type ToolbarEntry = ToolbarItemKey | typeof SEPARATOR;

export const DEFAULT_TOOLBAR: ToolbarEntry[] = [
	'heading',
	SEPARATOR,
	'bold',
	'italic',
	'strikethrough',
	'code',
	SEPARATOR,
	'bullet-list',
	'ordered-list',
	'task-list',
	SEPARATOR,
	'link',
	'image',
	'file',
	'table',
	SEPARATOR,
	'code-block',
	'quote',
	'hr',
	SEPARATOR,
	'mermaid',
	'bpmn',
	'excalidraw'
];

export function isToolbarItemKey(key: unknown): key is ToolbarItemKey {
	return typeof key === 'string' && Object.hasOwn(TOOLBAR_ITEMS, key);
}

/**
 * Makes any stored or submitted value a valid toolbar: drops unknown keys
 * and duplicates, and separators at the ends or next to each other.
 */
export function normalizeToolbar(input: unknown): ToolbarEntry[] {
	if (!Array.isArray(input)) return [...DEFAULT_TOOLBAR];

	const seen = new Set<string>();
	const result: ToolbarEntry[] = [];
	for (const entry of input) {
		if (entry === SEPARATOR) {
			if (result.length > 0 && result.at(-1) !== SEPARATOR) result.push(SEPARATOR);
		} else if (isToolbarItemKey(entry) && !seen.has(entry)) {
			seen.add(entry);
			result.push(entry);
		}
	}
	while (result.at(-1) === SEPARATOR) result.pop();
	return result;
}

/** Splits a toolbar into its groups (the runs between separators). */
export function toolbarGroups(toolbar: ToolbarEntry[]): ToolbarItemKey[][] {
	const groups: ToolbarItemKey[][] = [[]];
	for (const entry of toolbar) {
		if (entry === SEPARATOR) groups.push([]);
		else groups.at(-1)!.push(entry);
	}
	return groups.filter((group) => group.length > 0);
}
