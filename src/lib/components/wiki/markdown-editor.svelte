<script lang="ts">
	import { onMount } from 'svelte';
	import type { Crepe as CrepeType } from '@milkdown/crepe';
	import type { Ctx } from '@milkdown/kit/ctx';
	import type { Node as ProseNode } from '@milkdown/kit/prose/model';
	import type { EditorView } from '@milkdown/kit/prose/view';
	import { installEagerCodeBlocks } from '$lib/eager-code-blocks';
	import {
		DIAGRAM_ICONS,
		DIAGRAM_KINDS,
		DIAGRAM_LABELS,
		isDiagramKind,
		type DiagramKind
	} from '$lib/diagrams/kinds';
	import { renderDiagramPreview } from '$lib/diagrams/render';
	import type { ToolbarEntry, ToolbarItemKey } from '$lib/toolbar';
	import DiagramEditorDialog from './diagrams/diagram-editor-dialog.svelte';
	import EditorToolbar from './editor-toolbar.svelte';

	// lucide "paperclip", as an SVG string for Crepe's "/" menu.
	const PAPERCLIP_ICON =
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>';

	let {
		value = $bindable(''),
		readonly = false,
		placeholder = 'Tippe "/" für Befehle …',
		pageId,
		toolbar,
		onready,
		onerror,
		onupload
	}: {
		value?: string;
		readonly?: boolean;
		placeholder?: string;
		/** Enables image upload/paste/drag-drop once the page has an id (i.e. exists). */
		pageId?: string;
		/** Shows this toolbar above the editor while it's editable. */
		toolbar?: ToolbarEntry[];
		/** Fires once the Crepe instance has finished mounting. */
		onready?: () => void;
		/** Fires if Crepe fails to load or mount. */
		onerror?: (error: unknown) => void;
		/** Fires after a file or image was uploaded to the page. */
		onupload?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let crepe: CrepeType | undefined;
	let getView: (() => EditorView) | undefined;
	let commands: typeof import('$lib/editor-commands') | undefined;

	let toolbarActive = $state<Partial<Record<ToolbarItemKey, boolean>>>({});
	let headingLevel = $state<number | null>(null);

	/** Recomputes which toolbar items are active at the cursor. */
	function refreshToolbar() {
		if (!crepe || !commands || !toolbar || readonly) return;
		const { TOOLBAR_COMMANDS, currentHeadingLevel } = commands;
		crepe.editor.action((ctx) => {
			const next: Partial<Record<ToolbarItemKey, boolean>> = {};
			for (const [key, command] of Object.entries(TOOLBAR_COMMANDS)) {
				if (command.active) next[key as ToolbarItemKey] = command.active(ctx);
			}
			toolbarActive = next;
			headingLevel = currentHeadingLevel(ctx);
		});
	}

	function runToolbarItem(key: Exclude<ToolbarItemKey, 'heading'>) {
		if (!crepe || !commands) return;
		if (key === 'file') {
			pickFiles();
			return;
		}
		const { TOOLBAR_COMMANDS } = commands;
		crepe.editor.action((ctx) => {
			if (isDiagramKind(key)) insertDiagramAndEdit(ctx, key);
			else TOOLBAR_COMMANDS[key].run(ctx);
		});
		getView?.().focus();
		refreshToolbar();
	}

	function setHeading(level: number | null) {
		if (!crepe || !commands) return;
		const { setHeading } = commands;
		crepe.editor.action((ctx) => setHeading(ctx, level));
		getView?.().focus();
		refreshToolbar();
	}

	/** Inserts a diagram (from the toolbar or "/" menu) and opens its editor. */
	function insertDiagramAndEdit(ctx: Ctx, kind: DiagramKind, clearSlashText = false) {
		const pos = commands?.insertDiagram(ctx, kind, clearSlashText);
		const dom = pos != null ? getView?.().nodeDOM(pos) : null;
		if (dom instanceof Element) setTimeout(() => openDiagramEditor(dom));
	}

	/** The diagram code block being edited in the dialog, if any. */
	let diagramEdit = $state<{ kind: DiagramKind; source: string; dom: Element } | null>(null);

	/** Finds the code_block node a node view's DOM element belongs to. */
	function findCodeBlock(view: EditorView, dom: Element) {
		let found: { node: ProseNode; pos: number } | null = null;
		view.state.doc.descendants((node, pos) => {
			if (found) return false;
			if (node.type.name === 'code_block' && view.nodeDOM(pos) === dom) {
				found = { node, pos };
				return false;
			}
		});
		return found as { node: ProseNode; pos: number } | null;
	}

	function openDiagramEditor(dom: Element) {
		const view = getView?.();
		const block = view && findCodeBlock(view, dom);
		const language = String(block?.node.attrs.language ?? '');
		if (!block || !isDiagramKind(language)) return;
		diagramEdit = {
			kind: language.toLowerCase() as DiagramKind,
			source: block.node.textContent,
			dom
		};
	}

	function saveDiagram(source: string) {
		const view = getView?.();
		const edit = diagramEdit;
		diagramEdit = null;
		// Look the block up again: the document may have changed meanwhile.
		const block = view && edit && findCodeBlock(view, edit.dom);
		if (!view || !block) return;
		const content = source ? view.state.schema.text(source) : [];
		view.dispatch(
			view.state.tr.replaceWith(block.pos + 1, block.pos + block.node.nodeSize - 1, content)
		);
	}

	// The edit button lives in Crepe-sanitized preview HTML, so it can't
	// have its own handler — catch its clicks here instead.
	function onEditorClick(event: MouseEvent) {
		if (readonly) return;

		// While editing, a click on a link places the cursor in it. Without
		// this, SvelteKit's router follows it (it handles link clicks
		// anywhere in the document) and unsaved changes are lost.
		// Ctrl/Cmd-click opens it in a new tab instead.
		const link = (event.target as Element | null)?.closest?.('a[href]');
		if (link instanceof HTMLAnchorElement) {
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) window.open(link.href, '_blank', 'noopener');
			return;
		}

		const button = (event.target as Element | null)?.closest?.('[data-diagram-edit]');
		const block = button?.closest('.milkdown-code-block');
		if (!block) return;
		event.preventDefault();
		event.stopPropagation();
		openDiagramEditor(block);
	}

	async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
		if (!pageId)
			throw new Error(
				'Seite muss zuerst gespeichert werden, bevor Dateien hochgeladen werden können.'
			);

		const body = new FormData();
		body.set('file', file);
		body.set('pageId', pageId);

		const response = await fetch('/api/files', { method: 'POST', body });
		if (!response.ok) {
			const message = await response.text().catch(() => '');
			throw new Error(message || 'Upload fehlgeschlagen.');
		}

		const result: { url: string; filename: string } = await response.json();
		onupload?.();
		return result;
	}

	const uploadImage = async (file: File) => (await uploadFile(file)).url;

	let fileInput: HTMLInputElement | undefined = $state();
	let fileError = $state('');

	function pickFiles() {
		fileError = '';
		fileInput?.click();
	}

	async function onFilesPicked(files: FileList | null) {
		if (!files?.length) return;
		const picked = [...files];
		if (fileInput) fileInput.value = '';
		try {
			for (const [index, file] of picked.entries()) {
				const { url, filename } = await uploadFile(file);
				insertFileLink(url, filename, index > 0);
			}
		} catch (error) {
			fileError = error instanceof Error ? error.message : String(error);
		}
	}

	/**
	 * Inserts a download link to an uploaded file at the cursor, e.g.
	 * [Handbuch.pdf](/api/files/…). Used for new uploads and by the page's
	 * list of files that aren't linked anywhere.
	 */
	export function insertFileLink(url: string, filename: string, separate = false) {
		const view = getView?.();
		if (!view || readonly) return;
		const { schema } = view.state;
		const link = schema.marks.link.create({ href: url });
		let tr = view.state.tr;
		if (separate) tr = tr.insertText(', ');
		tr = tr.replaceSelectionWith(schema.text(filename, [link]), false);
		// Keep typing after the link as plain text.
		tr = tr.removeStoredMark(schema.marks.link).insertText(' ');
		view.dispatch(tr.scrollIntoView());
		view.focus();
	}

	onMount(() => {
		let destroyed = false;

		const mount = async () => {
			// Before Crepe creates its code-block observer, see eager-code-blocks.ts.
			installEagerCodeBlocks();
			const [{ Crepe }, { editorViewCtx }, editorCommands, { codeHighlighting }] =
				await Promise.all([
					import('@milkdown/crepe'),
					import('@milkdown/kit/core'),
					import('$lib/editor-commands'),
					import('$lib/code-highlight'),
					import('@milkdown/crepe/theme/common/style.css'),
					import('@milkdown/crepe/theme/classic.css')
				]);

			if (destroyed) return;
			commands = editorCommands;

			const instance = new Crepe({
				root: container,
				defaultValue: value,
				featureConfigs: {
					[Crepe.Feature.Placeholder]: { text: placeholder },
					[Crepe.Feature.ImageBlock]: {
						onUpload: uploadImage
					},
					// Diagram code blocks show the rendered diagram instead of
					// their source; see $lib/diagrams.
					[Crepe.Feature.CodeMirror]: {
						// Instead of One Dark, see $lib/code-highlight.ts.
						theme: codeHighlighting,
						previewOnlyByDefault: true,
						previewLabel: 'Vorschau',
						previewLoading: 'Diagramm wird geladen …',
						renderPreview: (language, content, applyPreview) => {
							if (!isDiagramKind(language)) return null;
							const kind = language.toLowerCase() as DiagramKind;
							renderDiagramPreview(kind, content).then(applyPreview);
							return undefined;
						}
					},
					[Crepe.Feature.BlockEdit]: {
						// The "/" menu, in German.
						textGroup: {
							label: 'Text',
							text: { label: 'Text' },
							h1: { label: 'Überschrift 1' },
							h2: { label: 'Überschrift 2' },
							h3: { label: 'Überschrift 3' },
							h4: { label: 'Überschrift 4' },
							h5: { label: 'Überschrift 5' },
							h6: { label: 'Überschrift 6' },
							quote: { label: 'Zitat' },
							divider: { label: 'Trennlinie' }
						},
						listGroup: {
							label: 'Listen',
							bulletList: { label: 'Aufzählung' },
							orderedList: { label: 'Nummerierte Liste' },
							taskList: { label: 'Checkliste' }
						},
						advancedGroup: {
							label: 'Einfügen',
							image: { label: 'Bild' },
							codeBlock: { label: 'Codeblock' },
							table: { label: 'Tabelle' },
							math: { label: 'Formel' }
						},
						buildMenu: (builder) => {
							builder.getGroup('advanced').addItem('file', {
								label: 'Datei',
								icon: PAPERCLIP_ICON,
								onRun: (ctx) => {
									editorCommands.clearSlashText(ctx);
									pickFiles();
								}
							});
							const group = builder.addGroup('diagrams', 'Diagramme');
							for (const kind of DIAGRAM_KINDS) {
								group.addItem(kind, {
									label: DIAGRAM_LABELS[kind],
									icon: DIAGRAM_ICONS[kind],
									onRun: (ctx) => insertDiagramAndEdit(ctx, kind, true)
								});
							}
						}
					}
				}
			});

			instance.on((listener) => {
				listener.markdownUpdated((_ctx, markdown) => {
					value = markdown;
				});
				listener.selectionUpdated(() => refreshToolbar());
				listener.updated(() => refreshToolbar());
			});

			instance.setReadonly(readonly);
			await instance.create();

			if (destroyed) {
				instance.destroy();
				return;
			}

			crepe = instance;
			getView = () => instance.editor.ctx.get(editorViewCtx);
			refreshToolbar();
			onready?.();
		};

		mount().catch((error) => {
			console.error('Editor konnte nicht geladen werden:', error);
			onerror?.(error);
		});

		return () => {
			destroyed = true;
			crepe?.destroy();
		};
	});

	$effect(() => {
		crepe?.setReadonly(readonly);
	});
</script>

{#if toolbar && !readonly}
	<EditorToolbar
		layout={toolbar}
		active={toolbarActive}
		{headingLevel}
		onrun={runToolbarItem}
		onheading={setHeading}
	/>
{/if}

<!-- Delegates clicks on the diagram edit buttons inside; they're keyboard-reachable buttons themselves. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div bind:this={container} class="milkdown-editor-root" onclick={onEditorClick}></div>

<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	aria-label="Datei hochladen"
	onchange={(event) => onFilesPicked(event.currentTarget.files)}
/>
{#if fileError}
	<p role="alert" class="mt-2 text-sm text-destructive">{fileError}</p>
{/if}

<DiagramEditorDialog
	kind={diagramEdit?.kind ?? null}
	source={diagramEdit?.source ?? ''}
	onsave={saveDiagram}
	oncancel={() => (diagramEdit = null)}
/>

<style>
	.milkdown-editor-root :global(.milkdown) {
		--crepe-color-background: transparent;
		/* Crepe's defaults name fonts that are only present if installed on
		   the viewer's machine (Open Sans, Georgia, Fira Code) — the PDF
		   renderer's container has none of them. Use the self-hosted copies
		   from layout.css instead; Gelasio is metric-compatible with Georgia. */
		--crepe-font-default: 'Open Sans Variable', Arial, Helvetica, sans-serif;
		--crepe-font-title: 'Gelasio Variable', Georgia, 'Times New Roman', serif;
		--crepe-font-code: 'Fira Code Variable', Menlo, Monaco, 'Courier New', monospace;
	}

	/* Crepe's colors, mapped onto the app's design tokens (layout.css) so
	   the editor and its popups (the "/" menu, the formatting toolbar, link
	   tooltips …) look like the rest of the app — and follow light/dark mode
	   by themselves. Printing always uses the light tokens
	   (print-preview.svelte). */
	.milkdown-editor-root :global(.milkdown) {
		--crepe-color-on-background: var(--foreground);
		--crepe-color-surface: var(--popover);
		--crepe-color-surface-low: var(--muted);
		--crepe-color-on-surface: var(--popover-foreground);
		--crepe-color-on-surface-variant: var(--muted-foreground);
		--crepe-color-outline: var(--muted-foreground);
		--crepe-color-primary: var(--primary);
		--crepe-color-secondary: var(--accent);
		--crepe-color-on-secondary: var(--accent-foreground);
		--crepe-color-inverse: var(--foreground);
		--crepe-color-on-inverse: var(--background);
		--crepe-color-inline-code: var(--foreground);
		--crepe-color-error: var(--destructive);
		--crepe-color-hover: var(--accent);
		/* Text selection: --accent is nearly white in light mode. */
		--crepe-color-selected: color-mix(in oklab, var(--foreground) 15%, transparent);
		--crepe-color-inline-area: var(--muted);
		/* Tailwind's shadow-md / shadow-lg, as used by the app's popovers. */
		--crepe-shadow-1: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
		--crepe-shadow-2: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
	}

	/* Code blocks sit on the muted surface, not the (white) popover one. */
	.milkdown-editor-root :global(.milkdown .milkdown-code-block) {
		--crepe-color-surface: var(--muted);
	}

	/* The line with the cursor: a faint tint in either mode — and none in
	   the read-only view, where there is no cursor. */
	.milkdown-editor-root :global(.milkdown :is(.cm-activeLine, .cm-activeLineGutter)) {
		background: color-mix(in oklab, var(--foreground) 6%, transparent);
	}
	.milkdown-editor-root
		:global(.ProseMirror[contenteditable='false'] :is(.cm-activeLine, .cm-activeLineGutter)) {
		background: transparent;
	}

	/* Syntax colors used by $lib/code-highlight.ts (GitHub's light/dark). */
	.milkdown-editor-root {
		--code-keyword: #cf222e;
		--code-string: #0a3069;
		--code-comment: #6e7781;
		--code-number: #0550ae;
		--code-function: #8250df;
		--code-type: #953800;
		--code-property: #0550ae;
		--code-definition: #953800;
		--code-invalid: #82071e;
	}
	:global(.dark) .milkdown-editor-root {
		--code-keyword: #ff7b72;
		--code-string: #a5d6ff;
		--code-comment: #8b949e;
		--code-number: #79c0ff;
		--code-function: #d2a8ff;
		--code-type: #ffa657;
		--code-property: #79c0ff;
		--code-definition: #ffa657;
		--code-invalid: #ffa198;
	}

	/* Popups: the app's UI font, corner radius and hairline border, like its
	   own dropdowns and dialogs. */
	.milkdown-editor-root
		:global(
			.milkdown
				:is(
					.milkdown-slash-menu,
					.milkdown-toolbar,
					.milkdown-link-preview,
					.milkdown-link-edit,
					.milkdown-latex-inline-edit
				)
		) {
		font-family: var(--font-sans);
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}

	/* Crepe's default 60px/120px padding would shrink the text column below
	   the width the surrounding page sets (PRINT_TEXT_WIDTH) — drop it so
	   the editor, the page view and the PDF all wrap text identically. */
	.milkdown-editor-root :global(.milkdown .ProseMirror) {
		padding: 0;
	}

	/* CodeMirror's base theme sets a generic "monospace" (Consolas on
	   Windows, something else in the PDF container) over Crepe's code font. */
	.milkdown-editor-root :global(.milkdown .cm-scroller) {
		font-family: var(--crepe-font-code);
	}

	/* Diagrams (see $lib/diagrams/render.ts): always drawn light on a white
	   card, in dark mode too, so they look the same on screen and on paper. */
	.milkdown-editor-root :global(.wiki-diagram) {
		position: relative;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		background: #ffffff;
		padding: 12px;
		text-align: center;
		white-space: normal;
	}
	/* A diagram replaces the code block's own frame rather than sitting
	   inside it. */
	.milkdown-editor-root :global(.milkdown .milkdown-code-block:has(.wiki-diagram)) {
		background: transparent;
		padding: 0;
	}
	.milkdown-editor-root :global(.milkdown .milkdown-code-block:has(.wiki-diagram) .preview-panel) {
		padding: 0;
		margin: 0;
	}
	/* Language picker / copy / "show source" are for editing only. */
	.milkdown-editor-root
		:global(.ProseMirror[contenteditable='false'] .milkdown-code-block:has(.wiki-diagram) .tools) {
		display: none;
	}
	.milkdown-editor-root :global(.wiki-diagram svg) {
		display: inline-block;
		max-width: 100%;
		height: auto;
	}
	.milkdown-editor-root :global(.wiki-diagram-error) {
		color: #ba1a1a;
		font-size: 0.875rem;
		text-align: left;
		white-space: pre-wrap;
	}
	.milkdown-editor-root :global(.wiki-diagram-edit) {
		position: absolute;
		top: 8px;
		right: 8px;
		border: 1px solid #d4d4d4;
		border-radius: 6px;
		background: #ffffff;
		color: #171717;
		padding: 2px 10px;
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.milkdown-editor-root :global(.wiki-diagram-edit:hover) {
		background: #f5f5f5;
	}
	.milkdown-editor-root :global(.ProseMirror[contenteditable='false'] .wiki-diagram-edit) {
		display: none;
	}

	/* A paperclip in front of links to uploaded files (see insertFileLink).
	   *= rather than ^=: the PDF makes links absolute (print-dom.ts). */
	.milkdown-editor-root :global(.milkdown a[href*='/api/files/']::before) {
		content: '';
		display: inline-block;
		width: 0.9em;
		height: 0.9em;
		margin-right: 0.15em;
		vertical-align: -0.1em;
		background-color: currentColor;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551'/%3E%3C/svg%3E")
			center / contain no-repeat;
	}

	/* Keep some room to click into when editing an (almost) empty page. */
	.milkdown-editor-root :global(.milkdown .ProseMirror[contenteditable='true']) {
		min-height: 12rem;
	}
</style>
