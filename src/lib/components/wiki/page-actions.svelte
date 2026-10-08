<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import { Button } from '$lib/components/ui/button';
	import PageBreakToggle from './page-break-toggle.svelte';
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils';

	let {
		path,
		canEdit,
		onexport,
		column = false
	}: {
		path: string;
		canEdit: boolean;
		/** Opens the PDF export dialog. */
		onexport: () => void;
		/** Stacked, for the panel beside the text; otherwise one row above it. */
		column?: boolean;
	} = $props();

	const item = $derived(column ? 'w-full justify-start' : '');
</script>

<div class={cn('flex gap-2', column ? 'flex-col items-stretch gap-1' : 'flex-wrap items-start')}>
	<Button variant="ghost" class={item} onclick={onexport}>
		<FileDownIcon data-icon="inline-start" />
		PDF
	</Button>
	<PageBreakToggle class={item} />
	<Button href={resolve('/(app)/w/[...path]/history', { path })} variant="ghost" class={item}>
		<HistoryIcon data-icon="inline-start" />
		Verlauf
	</Button>
	{#if canEdit}
		<Button href={resolve('/(app)/w/[...path]/edit', { path })} variant="outline" class={item}>
			<PencilIcon data-icon="inline-start" />
			Bearbeiten
		</Button>
	{/if}
</div>
