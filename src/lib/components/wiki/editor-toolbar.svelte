<script lang="ts" module>
	import type { Component } from 'svelte';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import CodeIcon from '@lucide/svelte/icons/code';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import ListTodoIcon from '@lucide/svelte/icons/list-todo';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ImageIcon from '@lucide/svelte/icons/image';
	import TableIcon from '@lucide/svelte/icons/table';
	import SquareCodeIcon from '@lucide/svelte/icons/square-code';
	import SigmaIcon from '@lucide/svelte/icons/sigma';
	import TextQuoteIcon from '@lucide/svelte/icons/text-quote';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import WorkflowIcon from '@lucide/svelte/icons/workflow';
	import GitForkIcon from '@lucide/svelte/icons/git-fork';
	import PenToolIcon from '@lucide/svelte/icons/pen-tool';
	import HeadingIcon from '@lucide/svelte/icons/heading';
	import type { ToolbarItemKey } from '$lib/toolbar';

	/** Icon per toolbar item; also used by the settings page. */
	export const TOOLBAR_ICONS: Record<ToolbarItemKey, Component> = {
		heading: HeadingIcon,
		bold: BoldIcon,
		italic: ItalicIcon,
		strikethrough: StrikethroughIcon,
		code: CodeIcon,
		'bullet-list': ListIcon,
		'ordered-list': ListOrderedIcon,
		'task-list': ListTodoIcon,
		link: LinkIcon,
		image: ImageIcon,
		table: TableIcon,
		'code-block': SquareCodeIcon,
		math: SigmaIcon,
		quote: TextQuoteIcon,
		hr: MinusIcon,
		mermaid: WorkflowIcon,
		bpmn: GitForkIcon,
		excalidraw: PenToolIcon
	};
</script>

<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { TOOLBAR_ITEMS, toolbarGroups, type ToolbarEntry } from '$lib/toolbar';

	/**
	 * The fixed toolbar above the editor. Purely presentational: the editor
	 * (markdown-editor.svelte) passes in what's active and runs the items.
	 */
	let {
		layout,
		active = {},
		headingLevel = null,
		onrun,
		onheading
	}: {
		layout: ToolbarEntry[];
		active?: Partial<Record<ToolbarItemKey, boolean>>;
		headingLevel?: number | null;
		onrun: (key: Exclude<ToolbarItemKey, 'heading'>) => void;
		onheading: (level: number | null) => void;
	} = $props();

	const HEADING_OPTIONS: { label: string; level: number | null }[] = [
		{ label: 'Text', level: null },
		{ label: 'Überschrift 1', level: 1 },
		{ label: 'Überschrift 2', level: 2 },
		{ label: 'Überschrift 3', level: 3 },
		{ label: 'Überschrift 4', level: 4 }
	];

	const headingLabel = $derived(
		HEADING_OPTIONS.find((option) => option.level === headingLevel)?.label ?? 'Text'
	);

	// Keep the editor focused (and its selection intact) when clicking a button.
	const keepEditorFocus = (event: PointerEvent) => event.preventDefault();
</script>

<div
	role="toolbar"
	aria-label="Formatierung"
	class="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background py-1"
>
	{#each toolbarGroups(layout) as group, groupIndex (groupIndex)}
		{#if groupIndex > 0}
			<div class="mx-1 h-5 w-px bg-border" role="separator"></div>
		{/if}
		{#each group as key (key)}
			{#if key === 'heading'}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="sm"
								class="w-32 justify-between"
								title={TOOLBAR_ITEMS.heading}
								onpointerdown={keepEditorFocus}
							>
								{headingLabel}
								<ChevronDownIcon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start">
						{#each HEADING_OPTIONS as option (option.label)}
							<DropdownMenu.Item onclick={() => onheading(option.level)}>
								{option.label}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				{@const Icon = TOOLBAR_ICONS[key]}
				<Button
					variant={active[key] ? 'secondary' : 'ghost'}
					size="icon-sm"
					title={TOOLBAR_ITEMS[key]}
					aria-label={TOOLBAR_ITEMS[key]}
					aria-pressed={key in active ? !!active[key] : undefined}
					onpointerdown={keepEditorFocus}
					onclick={() => onrun(key)}
				>
					<Icon />
				</Button>
			{/if}
		{/each}
	{/each}
</div>
