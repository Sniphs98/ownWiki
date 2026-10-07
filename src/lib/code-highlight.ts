import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Syntax colors for code blocks. Crepe defaults to One Dark, whose pale
 * text is hard to read on the light page. Here every color is a CSS
 * variable (defined in markdown-editor.svelte for light and dark mode), so
 * one CodeMirror extension follows the app's theme switch without
 * rebuilding the editor — and print, which is always light, gets the light
 * colors.
 */
const color = (name: string) => `var(--code-${name})`;

const style = HighlightStyle.define([
	{
		tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.moduleKeyword],
		color: color('keyword')
	},
	{ tag: [t.string, t.special(t.string), t.regexp], color: color('string') },
	{ tag: [t.comment, t.meta], color: color('comment'), fontStyle: 'italic' },
	{ tag: [t.number, t.bool, t.null, t.atom, t.literal], color: color('number') },
	{ tag: [t.function(t.variableName), t.function(t.propertyName)], color: color('function') },
	{ tag: [t.typeName, t.className, t.namespace], color: color('type') },
	{ tag: [t.propertyName, t.attributeName, t.labelName], color: color('property') },
	{ tag: [t.definition(t.variableName), t.tagName], color: color('definition') },
	{ tag: [t.heading, t.strong], fontWeight: 'bold' },
	{ tag: t.emphasis, fontStyle: 'italic' },
	{ tag: t.link, textDecoration: 'underline' },
	{ tag: t.invalid, color: color('invalid') }
]);

export const codeHighlighting = syntaxHighlighting(style);
