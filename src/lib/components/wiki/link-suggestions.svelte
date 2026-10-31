<!--
	@component
	The pages to link while a `[[wiki link]]` is typed in the editor: a
	shadcn Command list below the `[[`. The editor keeps the focus and steers
	it with the arrow keys (editor-link-suggest.ts); a click picks too.
-->
<script lang="ts" module>
	export type LinkSuggestion =
		{ kind: 'page'; path: string; title: string } | { kind: 'new'; name: string };

	export const suggestionKey = (item: LinkSuggestion) =>
		item.kind === 'page' ? `page:${item.path}` : `new:${item.name}`;
</script>

<script lang="ts">
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FilePlusIcon from '@lucide/svelte/icons/file-plus';
	import * as Command from '$lib/components/ui/command';

	let {
		items,
		active,
		left,
		top,
		bottom,
		onchoose
	}: {
		items: LinkSuggestion[];
		/** The highlighted one. */
		active: number;
		/** The line being typed in, in viewport pixels. */
		left: number;
		top: number;
		bottom: number;
		onchoose: (item: LinkSuggestion) => void;
	} = $props();

	let height = $state(0);
	let viewportHeight = $state(0);
	// Below the line, unless it would run off the bottom of the window.
	const y = $derived(
		bottom + 4 + height > viewportHeight && top - 4 - height > 0 ? top - 4 - height : bottom + 4
	);
</script>

<svelte:window bind:innerHeight={viewportHeight} />

<div
	class="fixed z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover text-popover-foreground shadow-md"
	style:left="{left}px"
	style:top="{y}px"
	bind:clientHeight={height}
	role="presentation"
	onmousedown={(event) => event.preventDefault()}
>
	<Command.Root
		shouldFilter={false}
		value={items[active] ? suggestionKey(items[active]) : ''}
		label="Seite verlinken"
	>
		<Command.List>
			<Command.Group heading="Seite verlinken">
				{#each items as item (suggestionKey(item))}
					<Command.Item value={suggestionKey(item)} onSelect={() => onchoose(item)}>
						{#if item.kind === 'page'}
							<FileTextIcon />
							<span class="min-w-0 flex-1 truncate">{item.title}</span>
							<span class="max-w-32 truncate text-xs text-muted-foreground">{item.path}</span>
						{:else}
							<FilePlusIcon />
							<span class="min-w-0 flex-1 truncate">„{item.name}“ verlinken</span>
							<span class="text-xs text-muted-foreground">neue Seite</span>
						{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.List>
	</Command.Root>
</div>
