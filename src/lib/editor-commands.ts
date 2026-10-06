import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import type { MarkType } from '@milkdown/kit/prose/model';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import {
	addBlockTypeCommand,
	blockquoteSchema,
	bulletListSchema,
	clearTextInCurrentBlockCommand,
	codeBlockSchema,
	emphasisSchema,
	headingSchema,
	hrSchema,
	inlineCodeSchema,
	linkSchema,
	listItemSchema,
	orderedListSchema,
	paragraphSchema,
	selectTextNearPosCommand,
	setBlockTypeCommand,
	strongSchema,
	toggleEmphasisCommand,
	toggleInlineCodeCommand,
	toggleStrongCommand,
	wrapInBlockTypeCommand
} from '@milkdown/kit/preset/commonmark';
import {
	createTable,
	strikethroughSchema,
	toggleStrikethroughCommand
} from '@milkdown/kit/preset/gfm';
import { DIAGRAM_TEMPLATES, type DiagramKind } from '$lib/diagrams/kinds';
import type { ToolbarItemKey } from '$lib/toolbar';

/**
 * What the editor toolbar's items do. Mirrors Crepe's own top bar
 * (@milkdown/crepe feature/top-bar), which we don't use because its buttons
 * have no labels — see editor-toolbar.svelte.
 */

export function isMarkActive(ctx: Ctx, markType: MarkType): boolean {
	const { state } = ctx.get(editorViewCtx);
	const { from, to, empty, $from } = state.selection;
	if (empty) return !!markType.isInSet(state.storedMarks ?? $from.marks());
	return state.doc.rangeHasMark(from, to, markType);
}

/** Heading level of the block holding the cursor, or null for a paragraph. */
export function currentHeadingLevel(ctx: Ctx): number | null {
	const { $from } = ctx.get(editorViewCtx).state.selection;
	return $from.parent.type === headingSchema.type(ctx) ? Number($from.parent.attrs.level) : null;
}

export function setHeading(ctx: Ctx, level: number | null) {
	const commands = ctx.get(commandsCtx);
	if (level === null) {
		commands.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) });
	} else {
		commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level } });
	}
}

/**
 * Inserts a diagram code block with the kind's template. Returns the
 * position of the new block, so the caller can open its editor.
 */
export function insertDiagram(ctx: Ctx, kind: DiagramKind, clearSlashText = false): number | null {
	const view = ctx.get(editorViewCtx);
	const commands = ctx.get(commandsCtx);
	if (clearSlashText) commands.call(clearTextInCurrentBlockCommand.key);
	const { from } = view.state.selection;
	const node = codeBlockSchema
		.type(ctx)
		.create({ language: kind }, view.state.schema.text(DIAGRAM_TEMPLATES[kind]));
	commands.call(addBlockTypeCommand.key, { nodeType: node });

	let inserted: number | null = null;
	const { doc } = view.state;
	doc.nodesBetween(
		Math.max(0, from - 2),
		Math.min(doc.content.size, from + 2),
		(candidate, pos) => {
			if (inserted !== null) return false;
			if (candidate.type.name === 'code_block' && candidate.attrs.language === kind) {
				inserted = pos;
				return false;
			}
		}
	);
	return inserted;
}

type Command = {
	run: (ctx: Ctx) => void;
	active?: (ctx: Ctx) => boolean;
};

const command = (run: (ctx: Ctx) => void): Command => ({ run });

/** All toolbar items except "heading" (a selector, see editor-toolbar.svelte). */
export const TOOLBAR_COMMANDS: Record<Exclude<ToolbarItemKey, 'heading'>, Command> = {
	bold: {
		run: (ctx) => ctx.get(commandsCtx).call(toggleStrongCommand.key),
		active: (ctx) => isMarkActive(ctx, strongSchema.type(ctx))
	},
	italic: {
		run: (ctx) => ctx.get(commandsCtx).call(toggleEmphasisCommand.key),
		active: (ctx) => isMarkActive(ctx, emphasisSchema.type(ctx))
	},
	strikethrough: {
		run: (ctx) => ctx.get(commandsCtx).call(toggleStrikethroughCommand.key),
		active: (ctx) => isMarkActive(ctx, strikethroughSchema.type(ctx))
	},
	code: {
		run: (ctx) => {
			const view = ctx.get(editorViewCtx);
			const { state } = view;
			const markType = inlineCodeSchema.type(ctx);
			// With nothing selected, toggle the mark for what's typed next.
			if (state.selection.empty) {
				view.dispatch(
					isMarkActive(ctx, markType)
						? state.tr.removeStoredMark(markType)
						: state.tr.addStoredMark(markType.create())
				);
			} else {
				ctx.get(commandsCtx).call(toggleInlineCodeCommand.key);
			}
		},
		active: (ctx) => isMarkActive(ctx, inlineCodeSchema.type(ctx))
	},
	'bullet-list': command((ctx) =>
		ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) })
	),
	'ordered-list': command((ctx) =>
		ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) })
	),
	'task-list': command((ctx) =>
		ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
			nodeType: listItemSchema.type(ctx),
			attrs: { checked: false }
		})
	),
	link: {
		run: (ctx) => {
			const view = ctx.get(editorViewCtx);
			const markType = linkSchema.type(ctx);
			if (view.state.selection.empty && isMarkActive(ctx, markType)) {
				view.dispatch(view.state.tr.removeStoredMark(markType));
				return;
			}
			ctx.get(commandsCtx).call(toggleLinkCommand.key);
		},
		active: (ctx) => isMarkActive(ctx, linkSchema.type(ctx))
	},
	image: command((ctx) =>
		ctx.get(commandsCtx).call(addBlockTypeCommand.key, { nodeType: imageBlockSchema.type(ctx) })
	),
	table: command((ctx) => {
		const commands = ctx.get(commandsCtx);
		const { from } = ctx.get(editorViewCtx).state.selection;
		commands.call(addBlockTypeCommand.key, { nodeType: createTable(ctx, 3, 3) });
		commands.call(selectTextNearPosCommand.key, { pos: from });
	}),
	'code-block': command((ctx) =>
		ctx.get(commandsCtx).call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) })
	),
	math: command((ctx) =>
		ctx.get(commandsCtx).call(addBlockTypeCommand.key, {
			nodeType: codeBlockSchema.type(ctx),
			attrs: { language: 'LaTeX' }
		})
	),
	quote: command((ctx) =>
		ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) })
	),
	hr: command((ctx) =>
		ctx.get(commandsCtx).call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) })
	),
	// markdown-editor.svelte runs these through insertDiagram itself, so it
	// can open the new diagram's editor right away.
	mermaid: command((ctx) => insertDiagram(ctx, 'mermaid')),
	bpmn: command((ctx) => insertDiagram(ctx, 'bpmn')),
	excalidraw: command((ctx) => insertDiagram(ctx, 'excalidraw'))
};
